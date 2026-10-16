package com.domalega.daymark;

import android.content.Context;
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
                    if (cached.has("state")) { SyncWorker.schedule(context, true); return new JSONObject().put("token", SyncCredentials.decrypt(cached.getString("credential"))); }
                } catch (OfflineHttp.Failure ignored) { }
            }
            JSONObject result = OfflineHttp.call(path, method, payload.optJSONObject("body"), token);
            if (result.has("token") && (path.equals("/user/auth") || path.equals("/user/login") || path.equals("/user/registration"))) {
                String verified = result.getString("token"), owner = OfflineSync.owner(verified);
                if (!owner.equals(store.active())) ReminderService.clear(context);
                store.activate(owner, verified);
                try { OfflineSync.run(context); } catch (Exception ignored) { /* Preserve a successful sign-in if initial download must be retried. */ }
                SyncWorker.schedule(context, true);
            }
            return result;
        }
        if (action.equals("logout")) { SyncWorker.cancel(context); store.logout(); return new JSONObject(); }
        if (action.equals("status")) return store.status();
        if (action.equals("sync")) { SyncWorker.schedule(context, true); return store.status(); }
        JSONObject doc = store.authorized(payload.optString("token", null));
        String owner = doc.getString("owner");
        if (action.equals("read")) {
            if (!doc.has("state")) { OfflineSync.run(context); doc = store.authorized(payload.optString("token", null)); }
            return OfflineStore.publicDocument(doc);
        }
        if (action.equals("write")) {
            JSONObject state = payload.getJSONObject("state");
            if (state.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 1_800_000 || !state.has("todos") || !state.has("board") || !state.has("medications")) throw new JSONException("Invalid offline data");
            JSONObject saved = store.update(owner, (current) -> {
                if (current.getLong("generation") != payload.getLong("generation")) throw new OfflineHttp.Failure(409, "The phone data changed. Try again.");
                current.put("state", state).put("generation", current.getLong("generation") + 1);
            });
            DeviceSyncPlan.refresh(context, saved);
            SyncWorker.schedule(context, true); return OfflineStore.publicDocument(saved);
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
}
