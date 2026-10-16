package com.domalega.daymark;

import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class SystemBarsTest {
    @Test public void webViewportAvoidsSystemBarsAndThemeMessagesChangeIconContrast() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicBoolean ready = new AtomicBoolean();
            AtomicReference<String> loading = new AtomicReference<>("");
            scenario.onActivity(activity -> {
                android.content.pm.PackageInfo provider = WebView.getCurrentWebViewPackage();
                System.out.println("WebView provider: " + (provider == null ? "none" : provider.packageName + " " + provider.versionName)
                    + "; message listener: " + androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.WEB_MESSAGE_LISTENER));
            });
            long deadline = android.os.SystemClock.elapsedRealtime() + 30000;
            do {
                scenario.onActivity(activity -> {
                    ViewGroup content = (ViewGroup) ((ViewGroup) activity.findViewById(android.R.id.content)).getChildAt(0);
                    WebView web = (WebView) content.getChildAt(0);
                    loading.set("url=" + web.getUrl() + ", progress=" + web.getProgress() + ", height=" + web.getHeight());
                    if (web.getProgress() == 100 && MainActivity.trusted(web.getUrl()) && web.getHeight() > 0) ready.set(true);
                });
                if (!ready.get()) android.os.SystemClock.sleep(50);
            } while (!ready.get() && android.os.SystemClock.elapsedRealtime() < deadline);
            assertTrue("Bundled UI must load: " + loading.get(), ready.get());
            scenario.onActivity(activity -> {
                ViewGroup content = (ViewGroup) ((ViewGroup) activity.findViewById(android.R.id.content)).getChildAt(0);
                WebView web = (WebView) content.getChildAt(0);
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(content);
                assertNotNull(insets);
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                int[] viewport = new int[2]; web.getLocationInWindow(viewport);
                assertTrue("Header must start below the status bar", viewport[1] >= bars.top);
                assertTrue("Viewport must avoid the left cutout", viewport[0] >= bars.left);
                assertTrue("Viewport must end before system navigation", viewport[1] + web.getHeight() <= activity.getWindow().getDecorView().getHeight() - bars.bottom);
            });
            for (String theme : new String[]{"light", "dark", "light"}) {
                ready.set(false);
                scenario.onActivity(activity -> {
                    ViewGroup content = (ViewGroup) ((ViewGroup) activity.findViewById(android.R.id.content)).getChildAt(0);
                    WebView web = (WebView) content.getChildAt(0);
                    // Use the real trusted WebView bridge, as ThemeProvider does.
                    web.evaluateJavascript("window.DaymarkAppearance.postMessage(JSON.stringify({theme:'" + theme + "'}))", null);
                });
                deadline = android.os.SystemClock.elapsedRealtime() + 3000;
                do {
                    scenario.onActivity(activity -> {
                        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView());
                        boolean light = "light".equals(theme);
                        ready.set(controller.isAppearanceLightStatusBars() == light && controller.isAppearanceLightNavigationBars() == light);
                    });
                    if (!ready.get()) android.os.SystemClock.sleep(50);
                } while (!ready.get() && android.os.SystemClock.elapsedRealtime() < deadline);
                assertTrue("System icons must follow " + theme + " app theme", ready.get());
            }
        }
    }
}
