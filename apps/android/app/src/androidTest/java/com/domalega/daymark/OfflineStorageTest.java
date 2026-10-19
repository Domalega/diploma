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
    @Test public void scopedBridgeReadsAndWritesKeepHistoryAndCredentialsOffTheWire() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OfflineStore store = OfflineStore.get(context);
        String owner = "scoped-bridge-test", token = "scoped-test-token";
        try {
            store.activate(owner, token);
            JSONObject state = new JSONObject("{todos:{enabled:true},board:{enabled:true,columns:[]},medications:{enabled:false,reminders:false,rows:[],slots:[]},'todo/a':{title:'Only todo'},'note/b':{comment:'Private note'}}");
            store.update(owner, (doc) -> doc.put("base", new JSONObject(state.toString())).put("state", state).put("history", new JSONObject("{deleted:[{id:1}]}" )).put("generation", 1));
            JSONObject read = (JSONObject) OfflineBridge.handle(context, "read", new JSONObject().put("token", token).put("path", "/todos"));
            assertFalse(read.has("credential")); assertFalse(read.has("history"));
            assertEquals(2, read.getJSONObject("state").length());
            assertFalse(read.getJSONObject("state").has("note/b"));
            String taskId = "10000000-0000-4000-8000-000000000001";
            state.put("task/" + taskId, new JSONObject().put("title", "Not uploaded yet"));
            JSONObject reply = (JSONObject) OfflineBridge.handle(context, "write", new JSONObject().put("token", token).put("state", state).put("generation", 1));
            assertEquals(1, reply.length()); assertEquals(2, reply.getLong("generation"));
            assertEquals(0, store.read(owner).getJSONObject("history").length());
            JSONObject page = (JSONObject) OfflineBridge.handle(context, "history", new JSONObject().put("token", token).put("taskId", taskId));
            assertEquals(0, page.getJSONArray("events").length());
            assertFalse(page.optBoolean("offline"));
            try { OfflineBridge.handle(context, "write", new JSONObject().put("token", token).put("state", state).put("generation", 1)); fail("Stale write"); }
            catch (OfflineHttp.Failure expected) { assertEquals(409, expected.status); }
        } finally {
            store.logout(); SyncWorker.cancel(context);
            store.getWritableDatabase().delete("accounts", "owner=?", new String[]{owner});
        }
    }
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
