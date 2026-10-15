package com.domalega.daymark;

import android.app.*;
import android.content.*;
import android.os.Build;
import android.Manifest;
import android.content.pm.PackageManager;
import org.json.*;
import java.time.*;
import java.util.*;

public final class ReminderService {
    static final String ALARM = "com.domalega.daymark.REMIND", TEST = "com.domalega.daymark.TEST";
    static final String CHANNEL = "daymark-reminders";
    static android.content.SharedPreferences store(Context c) { return c.getSharedPreferences("reminders", Context.MODE_PRIVATE); }
    static JSONObject read(Context c) {
        try { return new JSONObject(store(c).getString("plan", "")); } catch (JSONException e) { return null; }
    }
    static boolean allowed(Context c) {
        return c.getSystemService(NotificationManager.class).areNotificationsEnabled() &&
            (Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
    }
    static boolean exact(Context c) { return Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms(); }
    static void channel(Context c) {
        c.getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL, "Daymark reminders", NotificationManager.IMPORTANCE_HIGH));
    }
    static PendingIntent intent(Context c, String action, long at) {
        return PendingIntent.getBroadcast(c, action.equals(TEST) ? 2 : 1,
            new Intent(c, ReminderReceiver.class).setAction(action).putExtra("at", at), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void setAlarm(Context c, String action, long at) {
        AlarmManager alarms = c.getSystemService(AlarmManager.class);
        if (exact(c)) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent(c, action, at));
        else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent(c, action, at));
    }
    static void reschedule(Context c) throws JSONException {
        c.getSystemService(AlarmManager.class).cancel(intent(c, ALARM, 0));
        JSONObject plan = read(c);
        if (plan == null || !allowed(c)) return;
        ZonedDateTime next = Schedule.next(plan, ZonedDateTime.now());
        if (next != null) setAlarm(c, ALARM, next.toInstant().toEpochMilli());
    }
    static JSONObject status(Context c) throws JSONException {
        JSONObject result = new JSONObject();
        result.put("permission", allowed(c) ? "granted" : "default");
        result.put("exact", exact(c));
        result.put("savedAt", store(c).getString("savedAt", null));
        return result;
    }
    static JSONObject sync(Context c, JSONObject plan) throws JSONException {
        Schedule.validate(plan);
        JSONObject old = read(c);
        Schedule.merge(old, plan);
        String savedAt = Instant.now().toString();
        if (!store(c).edit().putString("plan", plan.toString()).putString("savedAt", savedAt).commit()) throw new JSONException("Unable to save reminders");
        reschedule(c);
        JSONArray onOpen = plan.optJSONArray("onOpen");
        String today = LocalDate.now().toString();
        Set<String> shown = new HashSet<>(store(c).getStringSet("allDaySent", Collections.emptySet()));
        shown.removeIf(key -> !key.startsWith(plan.optString("owner") + ":" + today + ":"));
        if (onOpen != null) for (int i = 0; i < onOpen.length(); i++) {
            JSONObject r = onOpen.getJSONObject(i);
            String key = plan.getString("owner") + ":" + today + ":" + r.getString("id");
            if (today.equals(r.getString("startDate")) && shown.add(key)) show(c, r.getString("id"), r.getString("title"), r.getString("body"));
        }
        store(c).edit().putStringSet("allDaySent", shown).commit();
        return status(c);
    }
    static void clear(Context c) {
        c.getSystemService(AlarmManager.class).cancel(intent(c, ALARM, 0));
        c.getSystemService(AlarmManager.class).cancel(intent(c, TEST, 0));
        store(c).edit().clear().commit();
        c.getSystemService(NotificationManager.class).cancelAll();
    }
    static void show(Context c, String id, String title, String body) {
        if (!allowed(c)) return;
        channel(c);
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notice = new Notification.Builder(c, CHANNEL).setSmallIcon(com.domalega.daymark.R.drawable.ic_daymark)
            .setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body))
            .setContentIntent(open).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).build();
        c.getSystemService(NotificationManager.class).notify(id, 1, notice);
    }
    static void deliver(Context c, long timestamp) throws JSONException {
        JSONObject plan = read(c);
        if (plan == null || timestamp <= store(c).getLong("lastDelivered", 0)) return;
        // Do not replay an old intake reminder after a long shutdown or suspended alarm.
        if (System.currentTimeMillis() - timestamp > 15 * 60 * 1000L) return;
        ZonedDateTime at = Instant.ofEpochMilli(timestamp).atZone(ZoneId.systemDefault());
        List<JSONObject> rules = Schedule.at(plan, at), meds = new ArrayList<>();
        store(c).edit().putLong("lastDelivered", timestamp).commit();
        for (JSONObject r : rules) {
            if (r.getString("kind").equals("medication")) meds.add(r);
            else show(c, r.getString("id"), r.getString("time") + " — " + r.getString("title"), r.getString("body"));
        }
        if (!meds.isEmpty()) {
            List<String> names = new ArrayList<>();
            for (JSONObject r : meds) names.add(r.getString("body"));
            show(c, "med:" + timestamp, meds.get(0).getString("time") + " — " + meds.get(0).getString("title"), String.join(", ", names));
        }
    }
}
