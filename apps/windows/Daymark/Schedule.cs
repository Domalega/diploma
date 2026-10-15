using System.Text.Json;

namespace Daymark;

public sealed class ReminderRule
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";
    public string StartDate { get; set; } = "";
    public string? EndDate { get; set; }
    public string Time { get; set; } = "";
    public int[] Weekdays { get; set; } = [];
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
}
public sealed class ReminderPlan
{
    public int Version { get; set; }
    public string Owner { get; set; } = "";
    public string Locale { get; set; } = "en";
    public ReminderRule[] Rules { get; set; } = [];
    public ReminderRule[] OnOpen { get; set; } = [];
    public string[] ShownAllDay { get; set; } = [];
    public Dictionary<string, string[]> Marks { get; set; } = [];
    public DateTimeOffset? SavedAt { get; set; }
}
public record ReminderEvent(string Id, DateTimeOffset At, string Title, string Body);

public static class Schedule
{
    public static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    public static ReminderPlan Parse(string json)
    {
        var plan = JsonSerializer.Deserialize<ReminderPlan>(json, Json) ?? throw new FormatException("Invalid reminder plan");
        if (plan.Version != 1 || string.IsNullOrEmpty(plan.Owner) || plan.Owner.Length > 100 || plan.Rules.Length > 6000) throw new FormatException("Invalid reminder plan");
        var ids = new HashSet<string>();
        foreach (var r in plan.Rules.Concat(plan.OnOpen))
        {
            if (string.IsNullOrEmpty(r.Id) || r.Id.Length > 200 || !ids.Add(r.Id) || r.Kind is not ("note" or "medication")) throw new FormatException("Invalid reminder rule");
            var start = DateOnly.ParseExact(r.StartDate, "yyyy-MM-dd");
            if (r.EndDate != null && DateOnly.ParseExact(r.EndDate, "yyyy-MM-dd") < start) throw new FormatException("Invalid course dates");
            TimeOnly.ParseExact(r.Time, "HH:mm");
            if (r.Title.Length > 200 || r.Body.Length > 2000 || r.Weekdays.Length is < 1 or > 7 || r.Weekdays.Any(d => d is < 0 or > 6)) throw new FormatException("Invalid reminder content");
        }
        return plan;
    }
    public static bool Due(ReminderPlan plan, ReminderRule rule, DateOnly day)
    {
        var date = day.ToString("yyyy-MM-dd");
        return string.CompareOrdinal(date, rule.StartDate) >= 0 &&
            (rule.EndDate == null || string.CompareOrdinal(date, rule.EndDate) <= 0) &&
            rule.Weekdays.Contains((int)day.DayOfWeek) &&
            !(plan.Marks.TryGetValue(date, out var marks) && marks.Contains(rule.Id));
    }
    public static DateTimeOffset At(DateOnly day, string time, TimeZoneInfo zone)
    {
        var wall = day.ToDateTime(TimeOnly.ParseExact(time, "HH:mm"), DateTimeKind.Unspecified);
        // For a spring DST gap, move the wall time forward into the next valid hour.
        while (zone.IsInvalidTime(wall)) wall = wall.AddHours(1);
        return new DateTimeOffset(wall, zone.GetUtcOffset(wall));
    }
    public static List<ReminderEvent> Upcoming(ReminderPlan plan, DateTimeOffset after, TimeZoneInfo zone, int days = 8)
    {
        var first = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(after, zone).DateTime);
        var result = new List<ReminderEvent>();
        for (var d = 0; d < days; d++)
        {
            var day = first.AddDays(d);
            var meds = new Dictionary<DateTimeOffset, List<ReminderRule>>();
            foreach (var r in plan.Rules)
            {
                if (!Due(plan, r, day)) continue;
                var at = At(day, r.Time, zone);
                if (at <= after) continue;
                if (r.Kind == "note") result.Add(new(r.Id, at, r.Time + " — " + r.Title, r.Body));
                else
                {
                    if (!meds.TryGetValue(at, out var group)) meds[at] = group = [];
                    group.Add(r);
                }
            }
            foreach (var (at, group) in meds)
                result.Add(new("med:" + at.ToUnixTimeSeconds(), at, group[0].Time + " — " + group[0].Title, string.Join(", ", group.Select(r => r.Body))));
        }
        return result.OrderBy(e => e.At).ThenBy(e => e.Id, StringComparer.Ordinal).ToList();
    }
    public static ReminderPlan Merge(ReminderPlan? old, ReminderPlan fresh)
    {
        if (old?.Owner == fresh.Owner)
        {
            fresh.ShownAllDay = old.ShownAllDay.Where(k => k.StartsWith(DateTime.Today.ToString("yyyy-MM-dd") + ":", StringComparison.Ordinal)).ToArray();
            foreach (var (date, marks) in old.Marks)
                if (!fresh.Marks.ContainsKey(date) && string.CompareOrdinal(date, DateTime.Today.ToString("yyyy-MM-dd")) >= 0) fresh.Marks[date] = marks;
        }
        return fresh;
    }
}
