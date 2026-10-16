package com.domalega.daymark;

import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class UpdateManifestTest {
    private JSONObject valid() throws Exception {
        return new JSONObject().put("schema", 1).put("channel", "preview").put("versionCode", 4).put("versionName", "0.3.1").put("minSdk", 26)
            .put("url", "https://github.com/Domalega/diploma/releases/download/native-preview-0.3.1/Daymark-Android-0.3.1.apk")
            .put("sha256", "ab".repeat(32)).put("size", 3000000);
    }
    @Test public void channelAndVersionAreExplicitAndDowngradesAreIgnored() throws Exception {
        UpdateManifest update = new UpdateManifest(valid());
        assertTrue(update.newerThan(3, 26)); assertFalse(update.newerThan(4, 35)); assertFalse(update.newerThan(5, 35)); assertFalse(update.newerThan(3, 25));
        assertEquals(update.sha256, new UpdateManifest(update.json()).sha256);
    }
    @Test public void rejectsInvalidMetadataAndOversizedPayloads() throws Exception {
        Object[][] cases = {{"schema", 2}, {"channel", "other"}, {"size", -1}, {"size", UpdateManifest.MAX_APK_BYTES + 1},
            {"sha256", "no checksum"}, {"minSdk", 1}, {"versionCode", 0}, {"versionName", "../../file"}, {"url", "http://github.com/Domalega/diploma/file.apk"}};
        for (Object[] entry : cases) {
            try { new UpdateManifest(valid().put((String) entry[0], entry[1])); fail("Accepted " + entry[0]); }
            catch (IllegalArgumentException expected) { }
        }
    }
    @Test public void onlyRepositoryReleaseAssetsCanBeSelected() {
        assertTrue(UpdateManifest.releaseUrl("https://github.com/Domalega/diploma/releases/download/native-preview-0.3.0/android-update.json"));
        for (String url : new String[]{"https://github.com.evil.test/Domalega/diploma/releases/download/native-preview-0.3.0/a.apk",
            "https://github.com/Other/repo/releases/download/native-preview-0.3.0/a.apk",
            "https://user@github.com/Domalega/diploma/releases/download/native-preview-0.3.0/a.apk",
            "https://github.com/Domalega/diploma/releases/download/native-preview-0.3.0/a.apk?redirect=other",
            "https://github.com/Domalega/diploma/releases/download/native-preview-0.3.0/%2e%2e/a.apk",
            "file:///data/data/com.domalega.daymark/files/update.apk"}) assertFalse(url, UpdateManifest.releaseUrl(url));
    }
}
