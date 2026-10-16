package com.domalega.daymark;

import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class UpdateDiscoveryTest {
    private String prefix(int code) { return "https://github.com/Domalega/diploma/releases/download/native-preview-0.3." + code + "/"; }
    private JSONObject release(int code, boolean draft) throws Exception {
        return new JSONObject().put("tag_name", "native-preview-0.3." + code).put("draft", draft)
            .put("assets", new JSONArray().put(new JSONObject().put("name", "android-update.json").put("browser_download_url", prefix(code) + "android-update.json").put("size", 500)));
    }
    private String manifest(String url) throws Exception {
        int code = url.contains("0.3.6") ? 6 : 4;
        return new JSONObject().put("schema", 1).put("channel", "preview").put("versionCode", code).put("versionName", "0.3." + code).put("minSdk", code == 6 ? 35 : 26)
            .put("url", prefix(code) + "Daymark.apk").put("size", 3000000).put("sha256", "ab".repeat(32)).toString();
    }
    @Test public void choosesTheNewestCompatiblePublishedPreviewEvenWhenNotLatestStable() throws Exception {
        JSONArray releases = new JSONArray().put(release(6, false)).put(release(4, false)).put(release(8, true));
        assertEquals(4, UpdateDiscovery.find(releases, 3, 29, this::manifest).code);
        assertEquals(6, UpdateDiscovery.find(releases, 3, 35, this::manifest).code);
        assertNull(UpdateDiscovery.find(releases, 6, 35, this::manifest));
    }
    @Test public void oldReleasesWithoutMetadataAreIgnoredAndNetworkErrorsDoNotInventAnUpdate() throws Exception {
        JSONObject old = new JSONObject().put("tag_name", "native-preview-0.2.0").put("assets", new JSONArray());
        assertNull(UpdateDiscovery.find(new JSONArray().put(old), 3, 29, this::manifest));
        try { UpdateDiscovery.find(new JSONArray().put(release(4, false)), 3, 29, url -> { throw new java.io.IOException("Offline"); }); fail("Network failures must propagate"); }
        catch (java.io.IOException expected) { }
    }
    @Test public void aManifestCannotPointAtAnotherRelease() throws Exception {
        try { UpdateDiscovery.find(new JSONArray().put(release(5, false)), 3, 29, this::manifest); fail("Mismatched release must fail"); }
        catch (java.io.IOException expected) { }
    }
}
