package com.domalega.daymark;

import java.net.URI;
import org.json.*;

/** Public release metadata. Never accepts arbitrary download hosts or downgrades. */
final class UpdateManifest {
    static final long MAX_APK_BYTES = 150L * 1024 * 1024;
    final int code, minSdk;
    final long size;
    final String version, url, sha256, notes;
    UpdateManifest(JSONObject json) throws Exception {
        code = json.getInt("versionCode"); minSdk = json.getInt("minSdk");
        version = json.getString("versionName"); url = json.getString("url");
        size = json.getLong("size"); sha256 = json.getString("sha256"); notes = json.optString("notes", "");
        if (json.getInt("schema") != 1 || !"preview".equals(json.getString("channel")) || code <= 0 || minSdk < 26
            || !version.matches("[0-9]+\\.[0-9]+\\.[0-9]+") || size <= 0 || size > MAX_APK_BYTES
            || !sha256.matches("[a-f0-9]{64}") || notes.length() > 4000 || !releaseUrl(url) || !new URI(url).getPath().endsWith(".apk"))
            throw new IllegalArgumentException("Invalid update metadata");
    }
    static boolean releaseUrl(String value) {
        try {
            URI uri = new URI(value);
            return "https".equals(uri.getScheme()) && "github.com".equals(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null
                && uri.getRawQuery() == null && uri.getRawFragment() == null
                && uri.getPath().matches("/Domalega/diploma/releases/download/native-preview-[0-9]+\\.[0-9]+\\.[0-9]+/[A-Za-z0-9._-]+")
                && !uri.getRawPath().contains("%");
        } catch (Exception error) { return false; }
    }
    boolean newerThan(int installed, int sdk) { return code > installed && minSdk <= sdk; }
    JSONObject json() throws JSONException {
        return new JSONObject().put("schema", 1).put("channel", "preview").put("versionCode", code).put("versionName", version)
            .put("minSdk", minSdk).put("url", url).put("size", size).put("sha256", sha256).put("notes", notes);
    }
}
