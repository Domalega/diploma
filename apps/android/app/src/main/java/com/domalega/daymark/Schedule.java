package com.domalega.daymark;

import org.json.*;
import java.time.*;
import java.util.*;

// Pure local-date scheduling; day-of-week numbering matches JavaScript (Sunday = 0).
public final class Schedule {
    public static JSONObject validate(JSONObject plan) throws JSONException {
        if (plan.getInt("version") != 1 || plan.getString("owner").length() > 100)
            throw new JSONException("Invalid reminder plan");
        JSONArray rules = new JSONArray();
        JSONArray timed = plan.getJSONArray("rules"), open = plan.optJSONArray("onOpen");
        for (int i = 0; i < timed.length(); i++) rules.put(timed.getJSONObject(i));
        if (open != null) for (int i = 0; i < open.length(); i++) rules.put(open.getJSONObject(i));
        if (rules.length() > 6000) throw new JSONException("Too many reminder rules");
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < rules.length(); i++) {
            JSONObject r = rules.getJSONObject(i);
            String id = r.getString("id"), kind = r.getString("kind");
            if (id.length() > 200 || !ids.add(id) || !(kind.equals("note") || kind.equals("medication"))) throw new JSONException("Invalid reminder rule");
            LocalDate start = LocalDate.parse(r.getString("startDate"));
            if (!r.isNull("endDate") && LocalDate.parse(r.getString("endDate")).isBefore(start)) throw new JSONException("Invalid course dates");
            if (!r.getString("time").matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]")) throw new JSONException("Invalid reminder time");
            LocalTime.parse(r.getString("time"));
            if (r.getString("title").length() > 200 || r.getString("body").length() > 2000) throw new JSONException("Invalid reminder text");
            JSONArray days = r.getJSONArray("weekdays");
            if (days.length() < 1 || days.length() > 7) throw new JSONException("Invalid weekdays");
            for (int d = 0; d < days.length(); d++) if (days.getInt(d) < 0 || days.getInt(d) > 6) throw new JSONException("Invalid weekday");
        }
        return plan;
    }
    public static boolean due(JSONObject plan, JSONObject r, LocalDate day) throws JSONException {
        String date = day.toString();
        if (date.compareTo(r.getString("startDate")) < 0 || (!r.isNull("endDate") && date.compareTo(r.getString("endDate")) > 0)) return false;
        JSONArray weekdays = r.getJSONArray("weekdays");
        boolean enabled = false;
        for (int i = 0; i < weekdays.length(); i++) enabled |= weekdays.getInt(i) == day.getDayOfWeek().getValue() % 7;
        if (!enabled) return false;
        JSONArray marks = plan.optJSONObject("marks") == null ? null : plan.getJSONObject("marks").optJSONArray(date);
        if (marks != null) for (int i = 0; i < marks.length(); i++) if (marks.getString(i).equals(r.getString("id"))) return false;
        return true;
    }
    public static ZonedDateTime next(JSONObject plan, ZonedDateTime after) throws JSONException {
        ZonedDateTime result = null;
        JSONArray rules = plan.getJSONArray("rules");
        for (int i = 0; i < rules.length(); i++) {
            JSONObject r = rules.getJSONObject(i);
            LocalDate start = LocalDate.parse(r.getString("startDate"));
            LocalDate first = start.isAfter(after.toLocalDate()) ? start : after.toLocalDate();
            // Marks can skip dates; scan past all retained marks, not just one week.
            int horizon = 8 + (plan.optJSONObject("marks") == null ? 0 : plan.getJSONObject("marks").length());
            for (int d = 0; d < horizon; d++) {
                LocalDate day = first.plusDays(d);
                ZonedDateTime at = day.atTime(LocalTime.parse(r.getString("time"))).atZone(after.getZone());
                if (at.isAfter(after) && due(plan, r, day)) {
                    if (result == null || at.isBefore(result)) result = at;
                    break;
                }
            }
        }
        return result;
    }
    public static List<JSONObject> at(JSONObject plan, ZonedDateTime at) throws JSONException {
        List<JSONObject> result = new ArrayList<>();
        JSONArray rules = plan.getJSONArray("rules");
        for (int i = 0; i < rules.length(); i++) {
            JSONObject r = rules.getJSONObject(i);
            if (r.getString("time").equals(at.toLocalTime().withSecond(0).withNano(0).toString()) && due(plan, r, at.toLocalDate())) result.add(r);
        }
        return result;
    }
    public static JSONObject merge(JSONObject old, JSONObject fresh) throws JSONException {
        JSONObject marks = fresh.getJSONObject("marks");
        if (old != null && old.optString("owner").equals(fresh.getString("owner"))) {
            JSONObject previous = old.optJSONObject("marks");
            if (previous != null) for (Iterator<String> it = previous.keys(); it.hasNext();) {
                String date = it.next();
                if (!marks.has(date) && date.compareTo(LocalDate.now().toString()) >= 0) marks.put(date, previous.getJSONArray(date));
            }
        }
        return fresh;
    }
}
