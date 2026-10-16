package com.domalega.daymark;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class LegacyMigrationTest {
    @Test public void restoreExportedData() throws Exception {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String encoded = InstrumentationRegistry.getArguments().getString("legacyBackup");
        assertNotNull(encoded);
        byte[] backup = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT);
        OfflineStore store = OfflineStore.get(c);
        try {
            assertTrue(LegacyBackup.canImport(c));
            assertEquals(1, LegacyBackup.restore(c, new java.io.ByteArrayInputStream(backup)));
            assertNull(store.active());
            JSONObject doc = store.read("12345");
            assertEquals("Pending from 0.2", doc.getJSONObject("state").getJSONObject("todo/migration").getString("title"));
            assertFalse(doc.has("credential")); assertFalse(doc.has("webCredential"));
            store.activate("12345", "new-sign-in-token");
            assertEquals(2, store.status().getInt("pending"));
            try { LegacyBackup.restore(c, new java.io.ByteArrayInputStream(backup)); fail("Do not overwrite existing data"); } catch (java.io.IOException expected) { }
            assertEquals(5, store.read("12345").getLong("generation"));
        } finally { store.logout(); store.getWritableDatabase().delete("accounts", "owner=?", new String[]{"12345"}); }
    }
}
