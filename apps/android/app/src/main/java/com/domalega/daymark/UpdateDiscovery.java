package com.domalega.daymark;

import java.io.IOException;
import org.json.*;

final class UpdateDiscovery {
    interface Metadata { String load(String url) throws Exception; }
    static UpdateManifest find(JSONArray releases, int installed, int sdk, Metadata metadata) throws Exception {
        UpdateManifest best = null;
        for (int i = 0; i < releases.length(); i++) {
            JSONObject release = releases.getJSONObject(i);
            if (release.optBoolean("draft") || !release.optString("tag_name").matches("native-preview-[0-9]+\\.[0-9]+\\.[0-9]+")) continue;
            JSONArray assets = release.getJSONArray("assets");
            for (int j = 0; j < assets.length(); j++) {
                JSONObject asset = assets.getJSONObject(j);
                if (!"android-update.json".equals(asset.optString("name"))) continue;
                String url = asset.getString("browser_download_url");
                if (!UpdateManifest.releaseUrl(url) || asset.getLong("size") > 16000) continue;
                UpdateManifest next = new UpdateManifest(new JSONObject(metadata.load(url)));
                if (!next.url.contains("/" + release.getString("tag_name") + "/")) throw new IOException("Release metadata mismatch");
                if (next.newerThan(installed, sdk) && (best == null || next.code > best.code)) best = next;
            }
        }
        return best;
    }
}
