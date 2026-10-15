package com.domalega.daymark;
import android.content.*;

public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        try {
            if (ReminderService.TEST.equals(intent.getAction())) {
                ReminderService.show(context, "test", "Daymark", "Local reminders work without an open browser or server.");
                return;
            }
            if (ReminderService.ALARM.equals(intent.getAction())) ReminderService.deliver(context, intent.getLongExtra("at", 0));
            ReminderService.reschedule(context);
        } catch (Exception e) {
            // Preserve the snapshot for retry on next app launch; never erase a valid saved plan.
            android.util.Log.e("Daymark", "Could not reschedule local reminders", e);
        }
    }
}
