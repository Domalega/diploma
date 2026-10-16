package com.domalega.daymark;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.*;

final class LegacyBackup {
    static boolean canImport(Context c) {
        try (Cursor cursor = OfflineStore.get(c).getReadableDatabase().rawQuery("SELECT COUNT(*) FROM accounts", null)) {
            return cursor.moveToFirst() && cursor.getLong(0) == 0;
        }
    }
    static int restore(Context c, InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int n;
        while ((n = input.read(buffer)) != -1) { if (output.size() + n > 8_000_000) throw new IOException("Backup is too large"); output.write(buffer, 0, n); }
        JSONObject backup = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
        if (backup.getInt("schema") != 1 || !"daymark-0.2".equals(backup.getString("source"))) throw new IOException("Unknown backup format");
        JSONArray accounts = backup.getJSONArray("accounts");
        if (accounts.length() == 0 || accounts.length() > 20) throw new IOException("Invalid backup accounts");
        OfflineStore store = OfflineStore.get(c);
        synchronized (store) {
            SQLiteDatabase db = store.getWritableDatabase(); db.beginTransaction();
            try {
                if (!canImport(c)) throw new IOException("Restore before signing in");
                java.util.Set<String> owners = new java.util.HashSet<>();
                for (int i = 0; i < accounts.length(); i++) {
                    JSONObject source = accounts.getJSONObject(i), document = new JSONObject();
                    String owner = source.getString("owner");
                    if (!owner.matches("[1-9][0-9]{0,18}") || !owners.add(owner) || source.getJSONObject("state").toString().length() > 1_800_000
                        || source.getLong("generation") < 0 || source.optLong("syncRevision") < 0) throw new IOException("Invalid account data");
                    source.getJSONObject("base"); source.getJSONObject("history");
                    for (String key : new String[]{"owner", "base", "state", "history", "generation", "syncRevision", "lastSync", "flight", "conflictRemote", "conflicts"})
                        if (source.has(key)) document.put(key, source.get(key));
                    document.put("authRequired", true);
                    ContentValues values = new ContentValues(); values.put("owner", owner); values.put("document", document.toString());
                    db.insertOrThrow("accounts", null, values);
                }
                db.setTransactionSuccessful(); return accounts.length();
            } finally { db.endTransaction(); }
        }
    }
}
