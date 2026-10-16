package com.domalega.daymark;

import android.app.NotificationManager;
import android.content.Context;
import android.service.notification.StatusBarNotification;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class UpdateNotificationTest {
    private StatusBarNotification posted(NotificationManager manager) {
        for (StatusBarNotification item : manager.getActiveNotifications()) if (item.getId() == UpdateManager.NOTIFICATION) return item;
        return null;
    }
    private StatusBarNotification awaitPosted(NotificationManager manager, boolean present) {
        long deadline = android.os.SystemClock.elapsedRealtime() + 3000;
        StatusBarNotification value;
        do {
            value = posted(manager); if ((value != null) == present) return value;
            android.os.SystemClock.sleep(50);
        } while (android.os.SystemClock.elapsedRealtime() < deadline);
        return value;
    }
    @Test public void announcesEachVersionOnceAndKeepsTheSelectedUpdateDuringDownload() throws Exception {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        NotificationManager manager = c.getSystemService(NotificationManager.class);
        UpdateManager.prefs(c).edit().clear().commit();
        try {
            UpdateManifest update = UpdateSecurityTest.fixture(c);
            UpdateManager.applyCheckResult(c, update);
            StatusBarNotification first = awaitPosted(manager, true);
            assertNotNull("The available update must post a native notification", first);
            assertEquals(UpdateManager.CHANNEL, first.getNotification().getChannelId());
            assertEquals(c.getPackageName(), first.getNotification().contentIntent.getCreatorPackage());
            assertEquals(update.code, UpdateManager.prefs(c).getInt("notified", 0));
            android.os.SystemClock.sleep(50);
            UpdateManager.applyCheckResult(c, update);
            assertEquals("Repeated checks must not repeat an alert", first.getPostTime(), posted(manager).getPostTime());
            UpdateManager.prefs(c).edit().putBoolean("downloading", true).putBoolean("installRequested", true).commit();
            UpdateManager.applyCheckResult(c, null);
            assertEquals(update.code, UpdateManager.candidate(c).code);
            UpdateManager.prefs(c).edit().putBoolean("downloading", false).putBoolean("installRequested", false).commit();
            UpdateManager.applyCheckResult(c, null);
            assertNull(UpdateManager.candidate(c)); assertNull(awaitPosted(manager, false));
        } finally { manager.cancel(UpdateManager.NOTIFICATION); UpdateManager.prefs(c).edit().clear().commit(); UpdateManager.apk(c).delete(); }
    }
}
