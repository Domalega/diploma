package com.domalega.daymark;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OfflineStorageTest {
    @Test public void pendingChangesSurviveSignOutAndAccountsStaySeparate() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OfflineStore store = OfflineStore.get(context);
        String alice = "offline-storage-test-a", bob = "offline-storage-test-b";
        try {
            store.activate(alice, "test-token-a");
            store.update(alice, (doc) -> doc.put("base", new JSONObject("{todos:{enabled:false}}"))
                .put("state", new JSONObject("{todos:{enabled:true},'todo/test':{title:'Pending',completed:false}}"))
                .put("history", new JSONObject()).put("generation", 1));
            assertEquals(2, store.status().getInt("pending"));
            assertEquals("Pending", store.authorized("test-token-a").getJSONObject("state").getJSONObject("todo/test").getString("title"));
            assertFalse(store.read(alice).getString("credential").contains("test-token-a"));
            assertFalse(OfflineStore.publicDocument(store.read(alice)).has("credential"));
            store.logout(); assertNull(store.active());
            store.activate(bob, "test-token-b");
            try { store.authorized("test-token-a"); fail("Other account tokens must not read this account"); } catch (OfflineHttp.Failure expected) { assertEquals(401, expected.status); }
            store.logout(); store.activate(alice, "test-token-a-new");
            assertEquals("Pending", store.authorized("test-token-a-new").getJSONObject("state").getJSONObject("todo/test").getString("title"));
            assertEquals(2, store.status().getInt("pending"));
        } finally {
            store.logout(); SyncWorker.cancel(context);
            store.getWritableDatabase().delete("accounts", "owner IN (?, ?)", new String[]{alice, bob});
        }
    }
}
