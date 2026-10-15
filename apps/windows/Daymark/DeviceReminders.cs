using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Microsoft.Toolkit.Uwp.Notifications;
using Windows.UI.Notifications;

namespace Daymark;

public static class DeviceReminders
{
    public static readonly string DataDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Daymark");
    static readonly string DataFile = Path.Combine(DataDirectory, "reminders.dat");
    static string TaskName => "DaymarkLocalReminders_" + WindowsIdentity.GetCurrent().User!.Value;
    static string Tag(string id) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(id)))[..16];
    static ToastNotifierCompat Notifier => ToastNotificationManagerCompat.CreateToastNotifier();
    static ReminderPlan? Load()
    {
        if (!File.Exists(DataFile)) return null;
        var raw = ProtectedData.Unprotect(File.ReadAllBytes(DataFile), null, DataProtectionScope.CurrentUser);
        return Schedule.Parse(Encoding.UTF8.GetString(raw));
    }
    static void Save(ReminderPlan plan)
    {
        Directory.CreateDirectory(DataDirectory);
        var raw = ProtectedData.Protect(JsonSerializer.SerializeToUtf8Bytes(plan, Schedule.Json), null, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(DataFile + ".tmp", raw);
        File.Move(DataFile + ".tmp", DataFile, true);
    }
    public static object Status() => new { permission = Notifier.Setting == NotificationSetting.Enabled ? "granted" : "denied", exact = true, savedAt = Load()?.SavedAt };
    public static object Sync(string json)
    {
        var plan = Schedule.Merge(Load(), Schedule.Parse(json));
        plan.SavedAt = DateTimeOffset.Now;
        // Register replenishment before reporting success; it runs locally, without network access.
        if (plan.Rules.Length > 0) RegisterTask(); else RemoveTask();
        Refresh(plan);
        var shown = plan.ShownAllDay.ToHashSet();
        var today = DateTime.Today.ToString("yyyy-MM-dd");
        foreach (var r in plan.OnOpen.Where(r => r.StartDate == today))
            if (shown.Add(today + ":" + r.Id)) Notifier.Show(new ToastNotification(new ToastContentBuilder().AddText(r.Title).AddText(r.Body).GetToastContent().GetXml()));
        plan.ShownAllDay = shown.ToArray();
        Save(plan);
        return Status();
    }
    public static void Refresh(ReminderPlan? plan = null)
    {
        plan ??= Load();
        if (plan == null) return;
        var events = Schedule.Upcoming(plan, DateTimeOffset.Now, TimeZoneInfo.Local);
        if (events.Count > 3500) throw new InvalidOperationException("Too many upcoming device reminders");
        var notifier = Notifier;
        // Keep only Daymark's own schedules; leave notification history alone.
        var existing = notifier.GetScheduledToastNotifications().Where(n => n.Group == "Daymark").ToList();
        foreach (var old in existing) notifier.RemoveFromSchedule(old);
        foreach (var e in events)
        {
            var content = new ToastContentBuilder().AddText(e.Title).AddText(e.Body).GetToastContent();
            notifier.AddToSchedule(new ScheduledToastNotification(content.GetXml(), e.At) { Tag = Tag(e.Id), Group = "Daymark" });
        }
    }
    public static void Clear()
    {
        // Erase the snapshot first so any already-started refill cannot reload old rules.
        if (File.Exists(DataFile)) File.Delete(DataFile);
        foreach (var n in Notifier.GetScheduledToastNotifications().Where(n => n.Group == "Daymark").ToList()) Notifier.RemoveFromSchedule(n);
        ToastNotificationManagerCompat.History.Clear();
        RemoveTask();
    }
    public static void Test()
    {
        var content = new ToastContentBuilder().AddText("Daymark").AddText("Local reminders work without an open browser or server.").GetToastContent();
        Notifier.AddToSchedule(new ScheduledToastNotification(content.GetXml(), DateTimeOffset.Now.AddSeconds(5)) { Tag = "test", Group = "Daymark" });
    }
    public static object ArmSmokeTest()
    {
        if (Load() != null) throw new InvalidOperationException("Do not overwrite an existing user reminder plan");
        RegisterTask();
        bool registered = Schtasks("/Query", "/TN", TaskName) == 0;
        RemoveTask();
        Test();
        return new { registered, permission = Notifier.Setting.ToString(), queued = Notifier.GetScheduledToastNotifications().Any(n => n.Group == "Daymark" && n.Tag == "test") };
    }
    public static object CheckSmokeTest()
    {
        if (Load() != null) throw new InvalidOperationException("Do not change an existing user reminder plan");
        bool delivered = ToastNotificationManagerCompat.History.GetHistory().Any(n => n.Group == "Daymark" && n.Tag == "test");
        bool queued = Notifier.GetScheduledToastNotifications().Any(n => n.Group == "Daymark" && n.Tag == "test");
        bool taskRemoved = Schtasks("/Query", "/TN", TaskName) != 0;
        ToastNotificationManagerCompat.Uninstall();
        return new { delivered, queued, taskRemoved };
    }
    static int Schtasks(params string[] arguments)
    {
        var info = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "schtasks.exe")) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        using var process = Process.Start(info) ?? throw new InvalidOperationException("Unable to start Task Scheduler");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit(15000)) { process.Kill(); throw new TimeoutException("Task Scheduler did not respond"); }
        Task.WaitAll(stdout, stderr);
        return process.ExitCode;
    }
    static void RemoveTask() => Schtasks("/Delete", "/TN", TaskName, "/F");
    static void RegisterTask()
    {
        Directory.CreateDirectory(DataDirectory);
        XNamespace ns = "http://schemas.microsoft.com/windows/2004/02/mit/task";
        var sid = WindowsIdentity.GetCurrent().User!.Value;
        XElement E(string name, object? value) => new(ns + name, value);
        var xml = new XDocument(new XDeclaration("1.0", "utf-16", null), new XElement(ns + "Task", new XAttribute("version", "1.2"),
            E("Triggers", new object[] {
                E("LogonTrigger", new object[] { E("Enabled", true), E("UserId", sid) }),
                E("CalendarTrigger", new object[] {
                    E("Repetition", new object[] { E("Interval", "PT1H"), E("Duration", "P1D"), E("StopAtDurationEnd", false) }),
                    E("StartBoundary", DateTime.Today.AddMinutes(5).ToString("yyyy-MM-ddTHH:mm:ss")), E("Enabled", true), E("ScheduleByDay", E("DaysInterval", 1)) }) }),
            E("Principals", new XElement(ns + "Principal", new XAttribute("id", "DaymarkUser"), E("UserId", sid), E("LogonType", "InteractiveToken"), E("RunLevel", "LeastPrivilege"))),
            E("Settings", new object[] { E("MultipleInstancesPolicy", "IgnoreNew"), E("DisallowStartIfOnBatteries", false), E("StopIfGoingOnBatteries", false), E("StartWhenAvailable", true), E("RunOnlyIfNetworkAvailable", false), E("ExecutionTimeLimit", "PT5M"), E("Enabled", true) }),
            new XElement(ns + "Actions", new XAttribute("Context", "DaymarkUser"), E("Exec", new object[] { E("Command", Environment.ProcessPath!), E("Arguments", "--refresh") }))));
        var file = Path.Combine(DataDirectory, "task.xml");
        try
        {
            File.WriteAllText(file, xml.ToString(), Encoding.Unicode);
            if (Schtasks("/Create", "/TN", TaskName, "/XML", file, "/F") != 0) throw new InvalidOperationException("Could not register the local reminder task");
        }
        finally { if (File.Exists(file)) File.Delete(file); }
    }
}
