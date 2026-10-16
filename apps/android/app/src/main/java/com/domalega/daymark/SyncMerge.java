package com.domalega.daymark;

import org.json.*;
import java.util.*;

// Same three-way, entity-level contract as server/src/services/syncMerge.js.
final class SyncMerge {
    static String canonical(Object value) throws JSONException {
        if (value == null) return "undefined";
        if (value == JSONObject.NULL) return "null";
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject) value;
            List<String> keys = new ArrayList<>(); object.keys().forEachRemaining(keys::add); Collections.sort(keys);
            List<String> parts = new ArrayList<>();
            for (String key : keys) parts.add(JSONObject.quote(key) + ":" + canonical(object.get(key)));
            return "{" + String.join(",", parts) + "}";
        }
        if (value instanceof JSONArray) {
            JSONArray array = (JSONArray) value; List<String> parts = new ArrayList<>();
            for (int i = 0; i < array.length(); i++) parts.add(canonical(array.get(i)));
            return "[" + String.join(",", parts) + "]";
        }
        return value instanceof String ? JSONObject.quote((String) value) : String.valueOf(value);
    }
    static boolean equal(Object a, Object b) throws JSONException { return canonical(a).equals(canonical(b)); }
    static Set<String> keys(JSONObject... values) {
        Set<String> keys = new TreeSet<>();
        for (JSONObject value : values) value.keys().forEachRemaining(keys::add);
        return keys;
    }
    static JSONObject merge(JSONObject base, JSONObject local, JSONObject remote, boolean preferRemote) throws JSONException {
        JSONObject state = new JSONObject(); JSONArray conflicts = new JSONArray();
        for (String key : keys(base, local, remote)) {
            Object b = base.opt(key), l = local.opt(key), r = remote.opt(key), value;
            if (key.startsWith("intake/") && l != null && r != null) value = r;
            else if (equal(l, b)) value = r;
            else if (equal(r, b) || equal(l, r)) value = l;
            else { conflicts.put(key); value = preferRemote ? r : l; }
            if (value != null) state.put(key, value);
        }
        return new JSONObject().put("state", state).put("conflicts", conflicts);
    }
    static int changes(JSONObject base, JSONObject local) throws JSONException {
        int count = 0; for (String key : keys(base, local)) if (!equal(base.opt(key), local.opt(key))) count++;
        return count;
    }
}
