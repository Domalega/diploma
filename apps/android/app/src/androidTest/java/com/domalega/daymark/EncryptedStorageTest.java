package com.domalega.daymark;

import android.content.*;
import android.database.Cursor;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class EncryptedStorageTest {
    @Test public void accountDocumentsAreEncryptedAndLegacyUpgradePreservesTheirContents() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OfflineStore store = OfflineStore.get(context);
        String owner = "encryption-storage-test";
        try {
            store.activate(owner, "private-test-token");
            store.update(owner, (doc) -> doc.put("privateText", "Secret stored locally"));
            try (Cursor cursor = store.getReadableDatabase().rawQuery("SELECT document FROM accounts WHERE owner=?", new String[]{owner})) {
                assertTrue(cursor.moveToFirst());
                String raw = cursor.getString(0);
                assertFalse(raw.contains("Secret stored locally"));
                assertFalse(raw.startsWith("{"));
                assertEquals("Secret stored locally", new JSONObject(SyncCredentials.decrypt(raw)).getString("privateText"));
            }
            JSONObject original = store.read(owner);
            ContentValues legacy = new ContentValues(); legacy.put("document", original.toString());
            store.getWritableDatabase().update("accounts", legacy, "owner=?", new String[]{owner});
            store.onOpen(store.getWritableDatabase());
            assertEquals(original.toString(), store.read(owner).toString());
        } finally {
            store.logout();
            store.getWritableDatabase().delete("accounts", "owner=?", new String[]{owner});
        }
    }
}
