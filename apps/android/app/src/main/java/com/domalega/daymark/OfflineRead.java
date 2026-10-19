package com.domalega.daymark;

import org.json.*;
import java.util.Iterator;

// Project only the requested section across the WebView bridge, never credentials or history.
final class OfflineRead {
    static JSONObject project(JSONObject document, String path) throws JSONException {
        if (!document.has("state")) throw new IllegalStateException("Connect once to download your data.");
        JSONObject source = document.getJSONObject("state"), state = new JSONObject();
        String prefix = null, settings = null;
        switch (path) {
            case "/state": state = source; break;
            case "/userDate/get": prefix = "note/"; break;
            case "/todos": settings = "todos"; prefix = "todo/"; break;
            case "/kanban": settings = "board"; prefix = "task/"; break;
            case "/medications/plan": settings = "medications"; break;
            default:
                if (!path.matches("/medications/intakes\\?date=[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new JSONException("Unsupported local read");
                prefix = "intake/" + path.substring(path.indexOf('=') + 1) + "/";
        }
        if (settings != null) state.put(settings, source.get(settings));
        if (prefix != null) for (Iterator<String> keys = source.keys(); keys.hasNext();) {
            String key = keys.next();
            if (key.startsWith(prefix)) state.put(key, source.get(key));
        }
        return new JSONObject().put("owner", document.getString("owner")).put("generation", document.getLong("generation")).put("state", state);
    }
}
