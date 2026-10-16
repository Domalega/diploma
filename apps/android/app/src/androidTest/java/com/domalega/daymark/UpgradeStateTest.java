package com.domalega.daymark;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Invoked explicitly before and after adb install -r by the CI upgrade smoke test. */
@RunWith(AndroidJUnit4.class)
public class UpgradeStateTest {
    private static final String OWNER = "upgrade-retention-test";
    @Test public void seed() throws Exception {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OfflineStore store = OfflineStore.get(c);
        store.activate(OWNER, "upgrade-test-token");
        store.update(OWNER, doc -> doc.put("base", new JSONObject("{todos:{enabled:false}}"))
            .put("state", new JSONObject("{todos:{enabled:true},'todo/upgrade':{title:'Keep this pending task',completed:false}}"))
            .put("history", new JSONObject()).put("generation", 1));
        c.getSharedPreferences("upgrade-test", Context.MODE_PRIVATE).edit().putString("keep", "saved-before-upgrade").commit();
    }
    @Test public void verifyRetained() throws Exception {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OfflineStore store = OfflineStore.get(c);
        assertEquals("saved-before-upgrade", c.getSharedPreferences("upgrade-test", Context.MODE_PRIVATE).getString("keep", null));
        assertEquals(OWNER, store.active());
        assertEquals("Keep this pending task", store.authorized("upgrade-test-token").getJSONObject("state").getJSONObject("todo/upgrade").getString("title"));
        assertEquals(2, store.status().getInt("pending"));
        store.logout(); store.getWritableDatabase().delete("accounts", "owner=?", new String[]{OWNER}); SyncWorker.cancel(c);
    }
    @Test public void prepareInstaller() throws Exception {
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context c = instrumentation.getTargetContext();
        // Keep a real foreground activity alive while the external CI driver confirms
        // the system dialog. Installing this update intentionally kills instrumentation.
        UpdateManager.prefs(c).edit().putLong("checkedAt", System.currentTimeMillis()).commit();
        android.app.Activity activity = instrumentation.startActivitySync(new android.content.Intent(c, MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));
        UpdateManifest update = UpdateSecurityTest.fixture(c);
        UpdateManager.verify(c, UpdateManager.apk(c), update);
        UpdateManager.prefs(c).edit().putString("candidate", update.json().toString()).putInt("ready", update.code).putBoolean("installRequested", true).commit();
        instrumentation.runOnMainSync(() -> { try { UpdateManager.install(activity); } catch (Exception error) { throw new RuntimeException(error); } });
        Thread.sleep(120000);
        fail("The system update must replace the target before this timeout");
    }
}
