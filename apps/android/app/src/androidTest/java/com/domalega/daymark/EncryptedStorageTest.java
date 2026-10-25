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
    @Test public void disablingPreparationAndOrdinaryRetriesNeverOverwritePendingNativeData() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OfflineStore store = OfflineStore.get(context);
        String owner = "disable-encryption-test", token = "disable-test-token";
        try {
            store.activate(owner, token);
            store.update(owner, (doc) -> doc.put("privateText", "Pending ordinary change"));
            OfflineBridge.handle(context, "unsealVault", new JSONObject().put("token", token));
            assertEquals("Pending ordinary change", store.read(owner).getString("privateText"));
            store.update(owner, (doc) -> doc.put("encrypted", true));
            OfflineBridge.handle(context, "unsealVault", new JSONObject().put("token", token).put("prepare", true));
            assertTrue(store.read(owner).getBoolean("encrypted"));
            assertTrue(OfflineHttp.supportedPath("/vault/disable"));
        } finally {
            store.logout();
            store.getWritableDatabase().delete("accounts", "owner=?", new String[]{owner});
        }
    }
    @Test public void deviceKeysUsePurposeBoundKeystoreProtection() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        OfflineStore store = OfflineStore.get(context);
        String owner = "device-key-protection-test", token = "device-key-test-token", key = "private-key-test-base64";
        try {
            store.activate(owner, token);
            JSONObject protectedKey = (JSONObject) OfflineBridge.handle(context, "protectDeviceKey", new JSONObject().put("token", token).put("data", key));
            assertFalse(protectedKey.getString("data").contains(key));
            JSONObject opened = (JSONObject) OfflineBridge.handle(context, "unprotectDeviceKey", new JSONObject().put("token", token).put("data", protectedKey.getString("data")));
            assertEquals(key, opened.getString("data"));
            try {
                OfflineBridge.handle(context, "unprotectDeviceKey", new JSONObject().put("token", token).put("data", SyncCredentials.encrypt("a different storage purpose")));
                fail("Unrelated ciphertext must not be opened as a device key");
            } catch (IllegalArgumentException expected) { }
        } finally {
            store.logout();
            store.getWritableDatabase().delete("accounts", "owner=?", new String[]{owner});
        }
    }
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
