package com.domalega.daymark;

import android.content.Context;
import org.json.*;

// Rebuild alarms from the complete local database, including changes fetched
// while the Activity is closed. Never display on-open notes from a background job.
final class DeviceSyncPlan {
    static void refresh(Context context, JSONObject document) {
        try {
            refreshPlan(context, document);
            ReminderService.store(context).edit().remove("syncError").apply();
        } catch (Exception error) {
            // Calendar data is already committed. Never turn an alarm failure
            // into a failed task save (a user retry could create a duplicate).
            ReminderService.store(context).edit().putString("syncError", "Device reminders could not be saved. Reopen the app and try again.").apply();
        }
    }
    private static void refreshPlan(Context context, JSONObject document) throws Exception {
        if (document != null && document.optBoolean("encrypted")) return;
        JSONObject old = ReminderService.read(context);
        if (old == null || document == null || !document.has("state") || !old.optString("owner").equals(document.getString("owner"))) return;
        JSONObject state = document.getJSONObject("state"), plan = state.getJSONObject("medications"), marks = new JSONObject();
        JSONArray rules = new JSONArray(), open = new JSONArray();
        boolean russian = old.optString("locale").startsWith("ru"), notes = old.optBoolean("notesEnabled", true);
        for (String key : SyncMerge.keys(state)) {
            JSONObject value = state.getJSONObject(key);
            if (key.startsWith("note/") && notes) {
                boolean timed = !value.isNull("time"); String date = value.getString("date");
                JSONObject rule = new JSONObject().put("id", "note:" + key.substring(5)).put("kind", "note").put("startDate", date).put("endDate", date)
                    .put("time", timed ? value.getString("time") : "00:00").put("weekdays", new JSONArray("[0,1,2,3,4,5,6]"))
                    .put("title", russian ? "Заметка на сегодня" : "A note for today").put("body", value.optString("comment", ""));
                (timed ? rules : open).put(rule);
            }
            if (key.startsWith("intake/")) {
                String date = value.getString("date"); JSONArray day = marks.optJSONArray(date);
                if (day == null) { day = new JSONArray(); marks.put(date, day); }
                day.put("med:" + value.getString("medicationId") + ":" + value.getString("slotId"));
            }
        }
        if (plan.getBoolean("enabled") && plan.getBoolean("reminders")) {
            JSONArray rows = plan.getJSONArray("rows"), slots = plan.getJSONArray("slots");
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i); JSONArray enabled = row.getJSONArray("slotIds");
                for (int j = 0; j < slots.length(); j++) {
                    JSONObject slot = slots.getJSONObject(j); boolean included = false;
                    for (int k = 0; k < enabled.length(); k++) included |= slot.getString("id").equals(enabled.getString(k));
                    if (included) rules.put(new JSONObject().put("id", "med:" + row.getString("id") + ":" + slot.getString("id")).put("kind", "medication")
                        .put("startDate", row.getString("startDate")).put("endDate", row.opt("endDate")).put("time", slot.getString("time")).put("weekdays", row.getJSONArray("weekdays"))
                        .put("title", russian ? "Напоминание о приёме" : "Medication reminder").put("body", row.getString("name")));
                }
            }
        }
        JSONObject fresh = new JSONObject().put("version", 1).put("owner", document.getString("owner")).put("locale", old.optString("locale", "en"))
            .put("notesEnabled", notes).put("marksComplete", true).put("rules", rules).put("onOpen", open).put("marks", marks);
        Schedule.validate(fresh);
        if (!ReminderService.store(context).edit().putString("plan", SyncCredentials.encrypt(fresh.toString())).commit()) throw new IllegalStateException("Unable to save reminders");
        ReminderService.reschedule(context);
    }
}
