using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Toolkit.Uwp.Notifications;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace Daymark;

public sealed class App : Application
{
    const string Home = "https://domalega.github.io/diploma/";
    static readonly Mutex DeviceLock = new(false, "Local\\Domalega.Daymark.Reminders");
    WebView2? web;
    [STAThread] public static void Main() => new App().Run();
    static bool Trusted(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.Host == "domalega.github.io" && uri.IsDefaultPort && string.IsNullOrEmpty(uri.UserInfo) && uri.AbsolutePath.StartsWith("/diploma/", StringComparison.Ordinal);
    static void Locked(Action action)
    {
        var acquired = false;
        try
        {
            try { acquired = DeviceLock.WaitOne(TimeSpan.FromSeconds(20)); } catch (AbandonedMutexException) { acquired = true; }
            if (!acquired) throw new TimeoutException("Device reminder update in progress");
            action();
        }
        finally { if (acquired) DeviceLock.ReleaseMutex(); }
    }
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        ShutdownMode = ShutdownMode.OnExplicitShutdown;
        ToastNotificationManagerCompat.OnActivated += _ => Dispatcher.InvokeAsync(async () => await OpenWindow());
        try
        {
            if (e.Args.Length == 2 && (e.Args[0] == "--self-test-arm" || e.Args[0] == "--self-test-check"))
            {
                Locked(() => File.WriteAllText(e.Args[1], JsonSerializer.Serialize(e.Args[0] == "--self-test-arm" ? DeviceReminders.ArmSmokeTest() : DeviceReminders.CheckSmokeTest())));
                Shutdown(); return;
            }
            if (e.Args.Contains("--refresh")) { Locked(() => DeviceReminders.Refresh()); Shutdown(); return; }
            if (e.Args.Contains("--clear")) { Locked(DeviceReminders.Clear); Shutdown(); return; }
            if (ToastNotificationManagerCompat.WasCurrentProcessToastActivated()) return;
            await OpenWindow();
        }
        catch (Exception ex)
        {
            if (e.Args.Length == 2 && e.Args[0].StartsWith("--self-test-", StringComparison.Ordinal)) { File.WriteAllText(e.Args[1], JsonSerializer.Serialize(new { error = ex.ToString() })); Shutdown(1); return; }
            if (e.Args.Contains("--refresh")) { Shutdown(1); return; }
            MessageBox.Show("Daymark could not start. Install or update Microsoft Edge WebView2 Runtime.\n\n" + ex.Message, "Daymark");
            Shutdown(1);
        }
    }
    async Task OpenWindow()
    {
        if (MainWindow != null) { MainWindow.Show(); MainWindow.Activate(); return; }
        web = new WebView2();
        MainWindow = new Window { Title = "Daymark", Width = 1280, Height = 850, MinWidth = 360, MinHeight = 560, Content = web };
        MainWindow.Closed += (_, _) => Shutdown();
        MainWindow.Show();
        Directory.CreateDirectory(DeviceReminders.DataDirectory);
        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: Path.Combine(DeviceReminders.DataDirectory, "WebView"));
        await web.EnsureCoreWebView2Async(environment);
        var core = web.CoreWebView2;
        core.Settings.AreHostObjectsAllowed = false;
        await core.AddScriptToExecuteOnDocumentCreatedAsync("window.__DAYMARK_NATIVE__ = true;");
        core.PermissionRequested += (_, args) => args.State = CoreWebView2PermissionState.Deny;
        core.NavigationStarting += (_, args) => { if (!Trusted(args.Uri)) { args.Cancel = true; External(args.Uri); } };
        core.NewWindowRequested += (_, args) => { args.Handled = true; if (Trusted(args.Uri)) core.Navigate(args.Uri); else External(args.Uri); };
        core.WebMessageReceived += (_, args) => {
            if (!Trusted(args.Source)) return;
            string id = "";
            try
            {
                var raw = args.TryGetWebMessageAsString();
                if (raw.Length > 2_000_000) throw new FormatException("Invalid device message");
                using var document = JsonDocument.Parse(raw);
                var message = document.RootElement;
                id = message.GetProperty("id").GetString() ?? "";
                object? result = null;
                Locked(() => {
                    result = message.GetProperty("action").GetString() switch {
                        "status" or "permission" or "exactSettings" => DeviceReminders.Status(),
                        "sync" => DeviceReminders.Sync(message.GetProperty("payload").GetRawText()),
                        "clear" => Clear(),
                        "test" => Test(),
                        "protectDeviceKey" => DeviceKeyProtection.Transform(message.GetProperty("payload"), true),
                        "unprotectDeviceKey" => DeviceKeyProtection.Transform(message.GetProperty("payload"), false),
                        _ => throw new FormatException("Unknown device action")
                    };
                });
                core.PostWebMessageAsJson(JsonSerializer.Serialize(new { id, result }, Schedule.Json));
            }
            catch { core.PostWebMessageAsJson(JsonSerializer.Serialize(new { id, error = "Could not update device reminders." })); }
        };
        MainWindow.Activated += (_, _) => { try { Locked(() => DeviceReminders.Refresh()); } catch { /* Retain the previous schedule on a temporary error. */ } };
        core.Navigate(Home + "#/calendar");
    }
    static object Clear() { DeviceReminders.Clear(); return new { permission = "default", exact = true }; }
    static object Test() { DeviceReminders.Test(); return new { permission = "granted" }; }
    static void External(string value)
    {
        if (Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https") Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
    }
}
