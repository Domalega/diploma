using Daymark;
using System.Text.Json;
using System.Security.Cryptography;
var raw = """
{"version":1,"owner":"1","marks":{},"rules":[{"id":"med:1:am","kind":"medication","startDate":"2026-10-01","endDate":null,"time":"08:00","weekdays":[1,3,5],"title":"Reminder","body":"Example"}]}
""";
var p = Schedule.Parse(raw);
var zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Novosibirsk");
var after = new DateTimeOffset(2026, 10, 15, 12, 0, 0, TimeSpan.FromHours(7));
void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
var events = Schedule.Upcoming(p, after, zone);
Check(events[0].At == new DateTimeOffset(2026, 10, 16, 8, 0, 0, TimeSpan.FromHours(7)), "Next matching weekday");
Check(events.All(e => e.At.DayOfWeek is DayOfWeek.Monday or DayOfWeek.Wednesday or DayOfWeek.Friday), "Only selected weekdays");
p.Marks["2026-10-16"] = ["med:1:am"];
Check(Schedule.Upcoming(p, after, zone)[0].At.Day == 19, "Marked intakes are skipped");
p.Rules[0].EndDate = "2026-10-17";
Check(Schedule.Upcoming(p, after, zone).Count == 0, "Course end is respected");
p = Schedule.Parse(raw);
p.Rules[0].Kind = "note"; p.Rules[0].Id = "note:1";
p.Rules[0].StartDate = p.Rules[0].EndDate = "2026-10-16";
Check(Schedule.Upcoming(p, after, zone).Count == 1, "Notes do not repeat");
Check(Schedule.Upcoming(p, events[0].At, zone).Count == 0, "Past events do not replay");
p = Schedule.Parse(raw);
p.Marks["2099-01-01"] = ["med:1:am"];
Check(Schedule.Merge(p, Schedule.Parse(raw)).Marks.ContainsKey("2099-01-01"), "Future marks survive refresh");
var other = Schedule.Parse(raw); other.Owner = "2";
Check(!Schedule.Merge(p, other).Marks.ContainsKey("2099-01-01"), "Accounts remain isolated");
var berlin = TimeZoneInfo.FindSystemTimeZoneById("Europe/Berlin");
Check(Schedule.At(new DateOnly(2026, 10, 25), "08:00", berlin).Offset == TimeSpan.FromHours(1), "DST uses the device's local wall time");
Console.WriteLine("All native scheduling checks passed.");
if (OperatingSystem.IsWindows())
{
    string privateKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(138));
    var protectedKey = JsonSerializer.SerializeToElement(DeviceKeyProtection.Transform(JsonSerializer.SerializeToElement(new { data = privateKey }), true));
    Check(protectedKey.GetProperty("data").GetString() != privateKey, "Device private keys are protected by DPAPI");
    var restored = JsonSerializer.SerializeToElement(DeviceKeyProtection.Transform(protectedKey, false));
    Check(restored.GetProperty("data").GetString() == privateKey, "Device key protection round trip");
    Console.WriteLine("Native device-key protection checks passed.");
}
