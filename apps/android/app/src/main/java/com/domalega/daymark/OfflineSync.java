package com.domalega.daymark;

import android.content.Context;
import android.util.Base64;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

final class OfflineSync {
    // Only one exchange may be in flight; SQLite writes can continue during HTTP.
    static synchronized void run(Context context) throws Exception {
        OfflineStore store = OfflineStore.get(context);
        String owner = store.active();
        JSONObject initial = store.read(owner);
        if (initial == null || !initial.has("credential") || initial.optJSONArray("conflicts") != null) return;
        String session = initial.getString("session");
        try {
            String oldToken = SyncCredentials.decrypt(initial.getString("credential"));
            JSONObject auth = OfflineHttp.call("/user/auth", "GET", null, oldToken);
            String token = auth.getString("token");
            if (!owner.equals(owner(token))) throw new OfflineHttp.Failure(401, "Sign in to synchronize your data.");
            if (!owner.equals(store.active())) return;
            store.update(owner, (doc) -> {
                guard(store, owner, session, doc);
                doc.put("credential", SyncCredentials.encrypt(token)).put("authRequired", false);
            });
            JSONObject document = store.read(owner);
            JSONObject flight = document.optJSONObject("flight");
            if (flight == null && document.has("state") && SyncMerge.changes(document.getJSONObject("base"), document.getJSONObject("state")) > 0) {
                document = store.update(owner, (doc) -> { guard(store, owner, session, doc); doc.put("flight", new JSONObject().put("version", 1).put("includeHistory", false).put("operationId", UUID.randomUUID().toString()).put("base", doc.getJSONObject("base")).put("local", doc.getJSONObject("state"))); });
                flight = document.getJSONObject("flight");
            }
            JSONObject result;
            try { result = OfflineHttp.call(flight == null ? "/sync?history=none" : "/sync", flight == null ? "GET" : "POST", flight, token); }
            catch (OfflineHttp.Failure failure) {
                if (failure.status != 409 || failure.response == null || !failure.response.has("state")) throw failure;
                if (!owner.equals(store.active())) return;
                JSONObject remote = failure.response;
                store.update(owner, (doc) -> {
                    guard(store, owner, session, doc);
                    doc.put("conflictRemote", remote.getJSONObject("state")).put("conflicts", remote.getJSONArray("conflicts"));
                    doc.put("error", "Choose which changes to keep.").remove("flight");
                });
                return;
            }
            if (!owner.equals(store.active())) return;
            JSONObject uploaded = flight == null ? document.optJSONObject("base") : flight.getJSONObject("local");
            store.update(owner, (doc) -> {
                guard(store, owner, session, doc);
                JSONObject remote = result.getJSONObject("state");
                JSONObject merged = !doc.has("state") ? new JSONObject().put("state", remote).put("conflicts", new JSONArray()) : SyncMerge.merge(uploaded, doc.getJSONObject("state"), remote, false);
                if (merged.getJSONArray("conflicts").length() > 0) {
                    doc.put("conflictRemote", remote).put("conflicts", merged.getJSONArray("conflicts"));
                    doc.put("error", "Choose which changes to keep.");
                } else doc.put("error", "");
                doc.put("base", remote).put("state", merged.getJSONObject("state"));
                if (result.has("history")) doc.put("history", result.getJSONObject("history"));
                OfflineHistory.prune(doc);
                doc.put("generation", doc.getLong("generation") + 1).put("syncRevision", doc.optLong("syncRevision") + 1).put("lastSync", Instant.now().toString());
                doc.remove("flight");
            });
            DeviceSyncPlan.refresh(context, store.read(owner));
        } catch (Exception error) {
            if (owner.equals(store.active()) && session.equals(store.read(owner).optString("session"))) store.update(owner, (doc) -> {
                guard(store, owner, session, doc);
                if (error instanceof OfflineHttp.Failure && ((OfflineHttp.Failure) error).status == 401) doc.put("authRequired", true);
                if (error instanceof OfflineHttp.Failure && (((OfflineHttp.Failure) error).status == 400 || ((OfflineHttp.Failure) error).status == 413)) doc.remove("flight");
                doc.put("error", error instanceof OfflineHttp.Failure ? error.getMessage() : "Offline. Your changes are saved on this phone.");
            });
            throw error;
        }
    }
    private static void guard(OfflineStore store, String owner, String session, JSONObject doc) throws Exception {
        if (!owner.equals(store.active()) || !session.equals(doc.optString("session"))) throw new InterruptedException("Session changed");
    }
    // Call only for a token just verified or returned by our fixed HTTPS API.
    static String owner(String verifiedToken) throws JSONException {
        String[] parts = verifiedToken.split("\\.");
        JSONObject payload = new JSONObject(new String(Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING), StandardCharsets.UTF_8));
        return String.valueOf(payload.getLong("id"));
    }
}
