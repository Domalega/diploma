package com.domalega.daymark;

import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.*;
import android.Manifest;
import androidx.webkit.*;
import org.json.*;
import java.util.Collections;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    static final String HOME = "https://appassets.androidplatform.net/assets/www/index.html";
    private final ExecutorService offlineExecutor = Executors.newSingleThreadExecutor();
    private WebView web;
    private JavaScriptReplyProxy permissionReply;
    private String permissionId;
    static boolean trusted(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value);
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null && uri.getPath().startsWith("/assets/www/");
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setFitsSystemWindows(true);
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) { return assets.shouldInterceptRequest(request.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (trusted(url)) return false;
                if (request.isForMainFrame() && "https".equals(request.getUrl().getScheme())) startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) new AlertDialog.Builder(MainActivity.this).setTitle("Daymark")
                    .setMessage("Could not open the bundled calendar. Reopen the app or install the latest APK. Saved device data is retained.")
                    .setPositiveButton("Retry", (dialog, which) -> web.loadUrl(HOME + "#/calendar")).setNegativeButton("Close", null).show();
            }
        });
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            new AlertDialog.Builder(this).setMessage("Update Android System WebView to use local reminders.").setPositiveButton("Close", (d,w) -> finish()).show();
            return;
        }
        WebViewCompat.addWebMessageListener(web, "DaymarkOffline", Collections.singleton("https://appassets.androidplatform.net"), (view, message, origin, mainFrame, reply) -> {
            if (!mainFrame || !trusted(view.getUrl())) return;
            String raw = message.getData();
            if (raw == null || raw.length() > 4_500_000) return;
            offlineExecutor.execute(() -> {
                JSONObject response = new JSONObject();
                try {
                    JSONObject request = new JSONObject(raw); response.put("id", request.getString("id"));
                    response.put("result", OfflineBridge.handle(this, request.getString("action"), request.optJSONObject("payload") == null ? new JSONObject() : request.getJSONObject("payload")));
                } catch (Exception error) {
                    try { response.put("error", error instanceof OfflineHttp.Failure || error instanceof IllegalStateException ? error.getMessage() : "Local storage could not be updated. Try again."); if (error instanceof OfflineHttp.Failure) response.put("status", ((OfflineHttp.Failure) error).status); } catch (JSONException ignored) { }
                }
                runOnUiThread(() -> { try { reply.postMessage(response.toString()); } catch (Exception ignored) { } });
            });
        });
        WebViewCompat.addWebMessageListener(web, "DaymarkNative", Collections.singleton("https://appassets.androidplatform.net"), (view, message, origin, mainFrame, reply) -> {
            if (!mainFrame || !trusted(view.getUrl())) return;
            String id = "";
            try {
                String raw = message.getData();
                if (raw == null || raw.length() > 2_000_000) throw new JSONException("Invalid message");
                JSONObject request = new JSONObject(raw);
                id = request.getString("id");
                JSONObject result;
                switch (request.getString("action")) {
                    case "status": result = ReminderService.status(this); break;
                    case "permission":
                        ReminderService.channel(this);
                        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                            if (permissionReply != null) throw new JSONException("Permission request already pending");
                            permissionId = id; permissionReply = reply;
                            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41); return;
                        }
                        result = ReminderService.status(this); break;
                    case "sync": result = ReminderService.sync(this, request.getJSONObject("payload")); DeviceSyncPlan.refresh(this, OfflineStore.get(this).read(OfflineStore.get(this).active())); break;
                    case "clear": ReminderService.clear(this); result = ReminderService.status(this); break;
                    case "test": ReminderService.setAlarm(this, ReminderService.TEST, System.currentTimeMillis() + 5000); result = ReminderService.status(this); break;
                    case "exactSettings":
                        if (Build.VERSION.SDK_INT >= 31 && !ReminderService.exact(this)) startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
                        result = ReminderService.status(this); break;
                    default: throw new JSONException("Unknown device action");
                }
                reply(reply, id, result, null);
            } catch (Exception e) { reply(reply, id, null, "Could not update device reminders."); }
        });
        web.loadUrl(HOME + "#/calendar");
    }
    private void reply(JavaScriptReplyProxy reply, String id, JSONObject result, String error) {
        try { JSONObject response = new JSONObject().put("id", id); if (error == null) response.put("result", result); else response.put("error", error); reply.postMessage(response.toString()); } catch (Exception ignored) { }
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 41 && permissionReply != null) {
            try { JSONObject status = ReminderService.status(this); if (!ReminderService.allowed(this)) status.put("permission", "denied"); reply(permissionReply, permissionId, status, null); } catch (JSONException ignored) { }
            permissionReply = null;
        }
    }
    @Override protected void onResume() {
        super.onResume();
        try { ReminderService.reschedule(this); } catch (JSONException ignored) { }
        if (OfflineStore.get(this).active() != null) SyncWorker.schedule(this, true);
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new Event('focus'))", null);
    }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { offlineExecutor.shutdownNow(); if (web != null) web.destroy(); super.onDestroy(); }
}
