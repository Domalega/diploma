package com.domalega.daymark;

import android.app.NotificationManager;
import android.content.Context;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AlarmSmokeTest {
    @Test public void systemAlarmDeliversWithoutAnyActivityOrWebPage() throws Exception {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        try {
            ReminderService.clear(c);
            ReminderService.channel(c);
            assertTrue("Emulator notifications must be enabled", ReminderService.allowed(c));
            JSONObject plan = new JSONObject("{\"version\":1,\"owner\":\"smoke-test\",\"rules\":[],\"onOpen\":[],\"marks\":{}}");
            assertNotNull(ReminderService.sync(c, plan).getString("savedAt"));
            assertEquals("smoke-test", ReminderService.read(c).getString("owner"));
            ReminderService.setAlarm(c, ReminderService.TEST, System.currentTimeMillis() + 3000);
            NotificationManager manager = c.getSystemService(NotificationManager.class);
            long deadline = SystemClock.elapsedRealtime() + 25000;
            boolean delivered = false;
            while (SystemClock.elapsedRealtime() < deadline) {
                for (android.service.notification.StatusBarNotification n : manager.getActiveNotifications()) delivered |= "test".equals(n.getTag());
                if (delivered) break;
                SystemClock.sleep(250);
            }
            assertTrue("The native receiver must deliver with no open web page", delivered);
        } finally { ReminderService.clear(c); }
    }
}
