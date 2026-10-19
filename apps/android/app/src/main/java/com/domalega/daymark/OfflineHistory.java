package com.domalega.daymark;

import org.json.*;
import java.util.*;

final class OfflineHistory {
    static JSONArray merge(JSONArray previous, JSONArray incoming) throws JSONException {
        Map<Long, JSONObject> events = new TreeMap<>(Collections.reverseOrder());
        for (JSONArray page : new JSONArray[]{previous, incoming}) {
            if (page == null) continue;
            for (int i = 0; i < page.length(); i++) {
                JSONObject event = page.getJSONObject(i);
                events.put(event.getLong("id"), event);
            }
        }
        return new JSONArray(events.values());
    }
    static JSONObject page(JSONArray saved, long before, int limit) throws JSONException {
        JSONArray ordered = merge(saved, null), events = new JSONArray();
        boolean more = false;
        for (int i = 0; i < ordered.length(); i++) {
            JSONObject event = ordered.getJSONObject(i);
            if (before > 0 && event.getLong("id") >= before) continue;
            if (events.length() == limit) { more = true; break; }
            events.put(event);
        }
        return new JSONObject().put("events", events).put("nextCursor", more ? events.getJSONObject(events.length() - 1).getLong("id") : JSONObject.NULL);
    }
    static void prune(JSONObject document) throws JSONException {
        JSONObject history = document.optJSONObject("history");
        if (history == null) return;
        JSONObject state = document.getJSONObject("state");
        for (Iterator<String> keys = history.keys(); keys.hasNext();) {
            if (!state.has("task/" + keys.next())) keys.remove();
        }
    }
}
