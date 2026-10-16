package com.domalega.daymark;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class BundledUiTest {
    @Test public void calendarAssetsArePackagedAndOnlyTheLocalOriginIsTrusted() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        try (InputStream input = context.getAssets().open("www/index.html")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            String html = bytes.toString("UTF-8");
            assertTrue(html.contains("./static/js/")); assertTrue(html.contains("id=\"root\""));
        }
        assertTrue(MainActivity.trusted(MainActivity.HOME));
        assertFalse(MainActivity.trusted("https://domalega.github.io/diploma/"));
        assertFalse(MainActivity.trusted("https://appassets.androidplatform.net.evil.example/assets/www/index.html"));
        assertFalse(MainActivity.trusted("https://appassets.androidplatform.net/other/index.html"));
        assertFalse(MainActivity.trusted("file:///android_asset/www/index.html"));
    }
}
