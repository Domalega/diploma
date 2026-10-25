package com.domalega.daymark;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import org.json.*;

final class OfflineBridge {
    static Object handle(Context context, String action, JSONObject payload) throws Exception {
        OfflineStore store = OfflineStore.get(context);
        if (action.equals("request")) {
            String path = payload.getString("path"), method = payload.optString("method", "GET");
            String token = payload.optString("token", null);
            if (path.equals("/user/auth") && token != null) {
                try {
                    JSONObject cached = store.authorized(token);
                    if (cached.has("state") || cached.optBoolean("encrypted")) { if (!cached.optBoolean("encrypted")) SyncWorker.schedule(context, true); return new JSONObject().put("token", SyncCredentials.decrypt(cached.getString("credential"))); }
                } catch (OfflineHttp.Failure ignored) { }
            }
            JSONObject result = OfflineHttp.call(path, method, payload.optJSONObject("body"), token);
            if (result.has("token") && (path.equals("/user/auth") || path.equals("/user/login") || path.equals("/user/registration"))) {
                String verified = result.getString("token"), owner = OfflineSync.owner(verified);
                if (!owner.equals(store.active())) ReminderService.clear(context);
                store.activate(owner, verified);
                boolean encrypted = store.read(owner).optBoolean("encrypted");
                try {
                    encrypted = OfflineHttp.call("/vault", "GET", null, verified).optBoolean("encrypted");
                    if (encrypted) store.update(owner, (doc) -> doc.put("vaultRemote", true));
                } catch (Exception ignored) { /* Keep existing local data if status cannot be refreshed. */ }
                if (!encrypted) {
                    try { OfflineSync.run(context); } catch (Exception ignored) { /* Preserve a successful sign-in if initial download must be retried. */ }
                    SyncWorker.schedule(context, true);
                } else SyncWorker.cancel(context);
            }
            return result;
        }
        if (action.equals("logout")) { SyncWorker.cancel(context); store.logout(); return new JSONObject(); }
        if (action.equals("status")) return store.status();
        if (action.equals("sync")) { SyncWorker.schedule(context, true); return store.status(); }
        JSONObject doc = store.authorized(payload.optString("token", null));
        String owner = doc.getString("owner");
        if (action.equals("protectDeviceKey") || action.equals("unprotectDeviceKey")) {
            String data = payload.getString("data"), prefix = "daymark-device-key-v1:";
            if (data.length() > 4096) throw new IllegalArgumentException("Invalid device key");
            if (action.equals("protectDeviceKey")) return new JSONObject().put("data", SyncCredentials.encrypt(prefix + data));
            String clear = SyncCredentials.decrypt(data);
            if (!clear.startsWith(prefix)) throw new IllegalArgumentException("Invalid device key");
            return new JSONObject().put("data", clear.substring(prefix.length()));
        }
        if (action.equals("legacyVault")) {
            if (doc.optBoolean("encrypted") || !doc.has("state")) return new JSONObject();
            return new JSONObject().put("base", doc.getJSONObject("base")).put("state", doc.getJSONObject("state")).put("history", doc.optJSONObject("history"));
        }
        if (action.equals("unsealVault")) {
            if (payload.optBoolean("prepare")) return new JSONObject().put("ready", true);
            if (!doc.optBoolean("encrypted") && !doc.optBoolean("vaultRemote")) return new JSONObject().put("ready", true);
            JSONObject remote = OfflineHttp.call("/vault", "GET", null, payload.getString("token"));
            if (remote.optBoolean("encrypted") || !remote.has("disabled")) throw new IllegalStateException("Encryption is still enabled on the server.");
            JSONObject legacy = remote.getJSONObject("legacy");
            JSONObject saved = store.update(owner, (current) -> {
                if (current.has("state")) current.put("vaultLegacyBackup", new JSONObject().put("state", current.getJSONObject("state")).put("base", current.optJSONObject("base")).put("history", current.optJSONObject("history")));
                current.put("state", legacy.getJSONObject("state")).put("base", legacy.getJSONObject("state")).put("history", legacy.optJSONObject("history"));
                current.put("encrypted", false).put("vaultRemote", false).put("generation", current.getLong("generation") + 1).put("syncRevision", current.optLong("syncRevision") + 1).put("error", "");
                current.remove("flight"); current.remove("conflicts"); current.remove("conflictRemote");
            });
            DeviceSyncPlan.refresh(context, saved);
            SyncWorker.schedule(context, true);
            return new JSONObject().put("ready", true);
        }
        if (action.equals("prepareVault")) {
            OfflineSync.run(context);
            JSONObject latest = store.authorized(payload.optString("token", null));
            if (latest.has("conflicts") || !latest.has("state") ||
                SyncMerge.changes(latest.getJSONObject("base"), latest.getJSONObject("state")) != 0)
                throw new IllegalStateException("Sync and resolve local changes before enabling encryption.");
            return new JSONObject();
        }
        if (action.equals("sealVault")) {
            if (!OfflineHttp.call("/vault", "GET", null, payload.getString("token")).optBoolean("encrypted"))
                throw new IllegalStateException("Encrypted data has not reached the server.");
            store.update(owner, (current) -> current.put("encrypted", true));
            SyncWorker.cancel(context);
            return new JSONObject();
        }
        if (doc.optBoolean("encrypted")) throw new IllegalStateException("Unlock your encrypted data in an updated Daymark client.");
        if (action.equals("read")) {
            if (!doc.has("state")) { OfflineSync.run(context); doc = store.authorized(payload.optString("token", null)); }
            return payload.has("path") ? OfflineRead.project(doc, payload.getString("path")) : OfflineStore.publicDocument(doc);
        }
        if (action.equals("history")) return history(context, store, doc, payload);
        if (action.equals("write")) {
            JSONObject state = payload.getJSONObject("state");
            if (state.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 1_800_000 || !state.has("todos") || !state.has("board") || !state.has("medications")) throw new JSONException("Invalid offline data");
            JSONObject saved = store.update(owner, (current) -> {
                if (current.getLong("generation") != payload.getLong("generation")) throw new OfflineHttp.Failure(409, "The phone data changed. Try again.");
                current.put("state", state).put("generation", current.getLong("generation") + 1);
                OfflineHistory.prune(current);
            });
            DeviceSyncPlan.refresh(context, saved);
            SyncWorker.schedule(context, true); return new JSONObject().put("generation", saved.getLong("generation"));
        }
        if (action.equals("resolve")) {
            if (!(payload.optString("choice").equals("remote") || payload.optString("choice").equals("local"))) throw new OfflineHttp.Failure(400, "Choose which changes to keep.");
            boolean remote = payload.getString("choice").equals("remote");
            store.update(owner, (current) -> {
                JSONObject server = current.getJSONObject("conflictRemote"), local = current.getJSONObject("state");
                JSONObject merged = SyncMerge.merge(current.getJSONObject("base"), local, server, remote).getJSONObject("state");
                // Explicitly resolve all server-reported units, including cross-entity validation conflicts.
                JSONArray keys = current.getJSONArray("conflicts");
                for (int i = 0; i < keys.length(); i++) {
                    String key = keys.getString(i); Object value = remote ? server.opt(key) : local.opt(key);
                    if (value == null) merged.remove(key); else merged.put(key, value);
                }
                current.put("base", server).put("state", merged).put("generation", current.getLong("generation") + 1).put("syncRevision", current.optLong("syncRevision") + 1).put("error", "");
                current.remove("conflictRemote"); current.remove("conflicts"); current.remove("flight");
            });
            SyncWorker.schedule(context, true); return store.status();
        }
        throw new JSONException("Unknown offline action");
    }
    private static Object history(Context context, OfflineStore store, JSONObject doc, JSONObject payload) throws Exception {
        String taskId = payload.getString("taskId"), owner = doc.getString("owner"), session = doc.getString("session");
        int limit = payload.optInt("limit", 50);
        long before = payload.isNull("before") ? 0 : payload.getLong("before");
        if (!taskId.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}") || limit < 1 || limit > 100 || before < 0)
            throw new OfflineHttp.Failure(400, "Choose a valid history page");
        if (!doc.getJSONObject("state").has("task/" + taskId)) throw new OfflineHttp.Failure(404, "Task was not found");
        if (!doc.getJSONObject("base").has("task/" + taskId)) {
            JSONObject localPage = cachedHistory(store, payload, owner, session, taskId, before, limit);
            localPage.remove("offline");
            return localPage;
        }
        ConnectivityManager connectivity = context.getSystemService(ConnectivityManager.class);
        NetworkCapabilities network = connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
        if (network == null || !network.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))
            return cachedHistory(store, payload, owner, session, taskId, before, limit);
        JSONObject page;
        try {
            String path = "/kanban/tasks/" + taskId + "/history?limit=" + limit + (before > 0 ? "&before=" + before : "");
            page = OfflineHttp.call(path, "GET", null, SyncCredentials.decrypt(doc.getString("credential")));
            JSONArray incoming = page.getJSONArray("events");
            store.update(owner, (current) -> {
                checkSession(store, current, owner, session);
                if (!current.getJSONObject("state").has("task/" + taskId)) throw new OfflineHttp.Failure(404, "Task was not found");
                JSONObject history = current.optJSONObject("history");
                if (history == null) { history = new JSONObject(); current.put("history", history); }
                history.put(taskId, OfflineHistory.merge(history.optJSONArray(taskId), incoming));
            });
        } catch (java.io.IOException error) {
            if (error instanceof OfflineHttp.Failure) {
                int status = ((OfflineHttp.Failure) error).status;
                if (status == 400 || status == 404) throw error;
            }
            if (error instanceof OfflineHttp.Failure && ((OfflineHttp.Failure) error).status == 401)
                store.update(owner, (current) -> { checkSession(store, current, owner, session); current.put("authRequired", true); });
            page = cachedHistory(store, payload, owner, session, taskId, before, limit);
        }
        return page;
    }
    private static JSONObject cachedHistory(OfflineStore store, JSONObject payload, String owner, String session, String taskId, long before, int limit) throws Exception {
        JSONObject latest = store.authorized(payload.optString("token", null));
        checkSession(store, latest, owner, session);
        if (!latest.getJSONObject("state").has("task/" + taskId)) throw new OfflineHttp.Failure(404, "Task was not found");
        JSONObject history = latest.optJSONObject("history");
        return OfflineHistory.page(history == null ? null : history.optJSONArray(taskId), before, limit).put("offline", true);
    }
    private static void checkSession(OfflineStore store, JSONObject doc, String owner, String session) throws Exception {
        if (!owner.equals(store.active()) || !session.equals(doc.optString("session"))) throw new OfflineHttp.Failure(401, "Sign in to synchronize your data.");
    }
}
