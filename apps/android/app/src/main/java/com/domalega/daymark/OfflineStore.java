package com.domalega.daymark;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;

final class OfflineStore extends SQLiteOpenHelper {
    private static OfflineStore instance;
    static synchronized OfflineStore get(Context context) {
        if (instance == null) instance = new OfflineStore(context.getApplicationContext());
        return instance;
    }
    private OfflineStore(Context context) { super(context, "daymark-offline.sqlite", null, 1); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE accounts (owner TEXT PRIMARY KEY, document TEXT NOT NULL)");
        db.execSQL("CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { throw new IllegalStateException("Unknown offline database version"); }
    synchronized String active() {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT value FROM metadata WHERE name='active'", null)) { return c.moveToFirst() ? c.getString(0) : null; }
    }
    synchronized JSONObject read(String owner) throws JSONException {
        if (owner == null) return null;
        try (Cursor c = getReadableDatabase().rawQuery("SELECT document FROM accounts WHERE owner=?", new String[]{owner})) { return c.moveToFirst() ? new JSONObject(c.getString(0)) : null; }
    }
    private void save(String owner, JSONObject document) {
        ContentValues values = new ContentValues(); values.put("owner", owner); values.put("document", document.toString());
        getWritableDatabase().replaceOrThrow("accounts", null, values);
    }
    interface Change { void apply(JSONObject document) throws Exception; }
    synchronized JSONObject update(String owner, Change change) throws Exception {
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try {
            JSONObject document = read(owner);
            if (document == null) throw new IllegalStateException("Connect once to download your data.");
            change.apply(document); save(owner, document); db.setTransactionSuccessful(); return document;
        } finally { db.endTransaction(); }
    }
    synchronized void activate(String owner, String token) throws Exception {
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try {
            JSONObject document = read(owner);
            if (document == null) document = new JSONObject().put("owner", owner).put("generation", 0).put("syncRevision", 0);
            document.put("credential", SyncCredentials.encrypt(token)).put("webCredential", SyncCredentials.encrypt(token)).put("session", java.util.UUID.randomUUID().toString());
            document.put("authRequired", false); save(owner, document);
            ContentValues active = new ContentValues(); active.put("name", "active"); active.put("value", owner);
            db.replaceOrThrow("metadata", null, active); db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    synchronized void logout() throws Exception {
        String owner = active();
        if (owner != null) update(owner, (document) -> { document.remove("credential"); document.remove("webCredential"); });
        getWritableDatabase().delete("metadata", "name='active'", null);
    }
    synchronized JSONObject authorized(String token) throws Exception {
        JSONObject doc = read(active());
        if (doc == null || token == null || !doc.has("credential")) throw new OfflineHttp.Failure(401, "Sign in to synchronize your data.");
        boolean matches = token.equals(SyncCredentials.decrypt(doc.getString("credential"))) || (doc.has("webCredential") && token.equals(SyncCredentials.decrypt(doc.getString("webCredential"))));
        if (!matches) throw new OfflineHttp.Failure(401, "Sign in to synchronize your data.");
        return doc;
    }
    static JSONObject publicDocument(JSONObject doc) throws JSONException {
        if (!doc.has("state")) throw new IllegalStateException("Connect once to download your data.");
        return new JSONObject().put("owner", doc.getString("owner")).put("generation", doc.getLong("generation")).put("state", doc.getJSONObject("state")).put("history", doc.optJSONObject("history"));
    }
    synchronized JSONObject status() throws Exception {
        JSONObject doc = read(active());
        if (doc == null) return new JSONObject().put("ready", false);
        JSONArray conflicts = new JSONArray();
        JSONObject remote = doc.optJSONObject("conflictRemote");
        JSONArray keys = doc.optJSONArray("conflicts");
        if (remote != null && keys != null) for (int i = 0; i < keys.length(); i++) {
            String key = keys.getString(i);
            conflicts.put(new JSONObject().put("key", key).put("local", doc.getJSONObject("state").opt(key)).put("remote", remote.opt(key)));
        }
        return new JSONObject().put("ready", doc.has("state")).put("pending", doc.has("state") ? SyncMerge.changes(doc.getJSONObject("base"), doc.getJSONObject("state")) : 0)
            .put("syncRevision", doc.optLong("syncRevision")).put("lastSync", doc.opt("lastSync")).put("error", doc.optString("error", ""))
            .put("authRequired", doc.optBoolean("authRequired")).put("conflicts", conflicts);
    }
}
