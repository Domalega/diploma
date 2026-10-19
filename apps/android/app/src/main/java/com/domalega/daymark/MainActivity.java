package com.domalega.daymark;

import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.*;
import android.Manifest;
import android.content.res.Configuration;
import android.graphics.Color;
import android.view.WindowManager;
import android.widget.FrameLayout;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.*;
import org.json.*;
import java.util.Collections;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    static final String HOME = "https://appassets.androidplatform.net/assets/www/index.html";
    private final ExecutorService offlineExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService historyExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();
    private final Handler updateHandler = new Handler(Looper.getMainLooper());
    private JavaScriptReplyProxy updatePermissionReply;
    private String updatePermissionId;
    private boolean updateDialogVisible;
    private boolean resumed;
    private final Runnable updateTick = new Runnable() {
        @Override public void run() {
            if (!resumed) return;
            updateHandler.postDelayed(this, 1500);
            try {
                if (UpdateManager.prefs(MainActivity.this).getBoolean("installRequested", false)
                    && UpdateManager.status(MainActivity.this).getBoolean("ready")) UpdateManager.install(MainActivity.this);
            } catch (Exception error) {
                UpdateManager.installFailed(MainActivity.this, error);
            }
        }
    };
    private WebView web;
    private FrameLayout content;
    private JavaScriptReplyProxy permissionReply;
    private String permissionId;
    static boolean trusted(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value);
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null && uri.getPath().startsWith("/assets/www/");
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        content = new FrameLayout(this);
        web = new WebView(this);
        content.addView(web, new FrameLayout.LayoutParams(-1, -1));
        // Keep every WebView screen (including fixed drawers and dialogs) inside the safe area.
        // Consume the insets here so WebView does not add a second set of offsets.
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        boolean systemDark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        applySystemTheme(getSharedPreferences("appearance", MODE_PRIVATE).getString("theme", systemDark ? "dark" : "light"));
        setContentView(content);
        ViewCompat.requestApplyInsets(content);
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
        WebViewCompat.addWebMessageListener(web, "DaymarkAppearance", Collections.singleton("https://appassets.androidplatform.net"), (view, message, origin, mainFrame, reply) -> {
            if (!mainFrame || !trusted(view.getUrl())) return;
            String raw = message.getData();
            if (raw == null || raw.length() > 100) return;
            try {
                String theme = new JSONObject(raw).getString("theme");
                if ("light".equals(theme) || "dark".equals(theme)) runOnUiThread(() -> applySystemTheme(theme));
            } catch (JSONException ignored) { }
        });
        WebViewCompat.addWebMessageListener(web, "DaymarkOffline", Collections.singleton("https://appassets.androidplatform.net"), (view, message, origin, mainFrame, reply) -> {
            if (!mainFrame || !trusted(view.getUrl())) return;
            String raw = message.getData();
            if (raw == null || raw.length() > 4_500_000) return;
            offlineExecutor.execute(() -> {
                JSONObject request;
                try { request = new JSONObject(raw); } catch (JSONException ignored) { return; }
                Runnable action = () -> {
                    JSONObject response = new JSONObject();
                    try {
                        response.put("id", request.getString("id"));
                        response.put("result", OfflineBridge.handle(this, request.getString("action"), request.optJSONObject("payload") == null ? new JSONObject() : request.getJSONObject("payload")));
                    } catch (Exception error) {
                        try { response.put("error", error instanceof OfflineHttp.Failure || error instanceof IllegalStateException ? error.getMessage() : "Local storage could not be updated. Try again."); if (error instanceof OfflineHttp.Failure) response.put("status", ((OfflineHttp.Failure) error).status); } catch (JSONException ignored) { }
                    }
                    runOnUiThread(() -> { try { reply.postMessage(response.toString()); } catch (Exception ignored) { } });
                };
                if ("history".equals(request.optString("action"))) historyExecutor.execute(action);
                else action.run();
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
        WebViewCompat.addWebMessageListener(web, "DaymarkUpdates", Collections.singleton("https://appassets.androidplatform.net"), (view, message, origin, mainFrame, reply) -> {
            if (!mainFrame || !trusted(view.getUrl())) return;
            String id = "";
            try {
                String raw = message.getData(); if (raw == null || raw.length() > 1000) throw new JSONException("Invalid update request");
                JSONObject request = new JSONObject(raw); id = request.getString("id");
                String action = request.getString("action");
                if ("status".equals(action)) { reply(reply, id, UpdateManager.status(this), null); return; }
                if ("notifications".equals(action) && !UpdateManager.notificationsAllowed(this)
                    && ((Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
                        || (UpdateManager.prefs(this).getBoolean("notificationPermissionRequested", false) && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)))) {
                    startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
                    reply(reply, id, UpdateManager.status(this), null); return;
                }
                if ("restoreLegacy".equals(action)) {
                    if (!LegacyBackup.canImport(this)) throw new IllegalStateException("Restore before signing in");
                    startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json"), 44);
                    reply(reply, id, UpdateManager.status(this), null); return;
                }
                if ("notifications".equals(action) && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    if (updatePermissionReply != null) throw new IllegalStateException("Permission request pending");
                    updatePermissionReply = reply; updatePermissionId = id;
                    UpdateManager.prefs(this).edit().putBoolean("notificationPermissionRequested", true).apply();
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 42); return;
                }
                final String replyId = id;
                updateExecutor.execute(() -> {
                    try {
                        switch (action) {
                            case "check": UpdateManager.check(this); break;
                            case "install": UpdateManager.download(this); break;
                            case "status": case "notifications": break;
                            default: throw new IllegalArgumentException("Unknown update action");
                        }
                        JSONObject result = UpdateManager.status(this); runOnUiThread(() -> reply(reply, replyId, result, null));
                    } catch (Exception error) {
                        runOnUiThread(() -> reply(reply, replyId, null, "Could not check for updates. Check your connection and try again."));
                    }
                });
            } catch (Exception error) { reply(reply, id, null, "Could not update the app. Try again."); }
        });
        web.loadUrl(HOME + "#/calendar");
        if (getIntent().getBooleanExtra("showUpdates", false)) showUpdateDialog();
    }
    private void applySystemTheme(String theme) {
        boolean dark = "dark".equals(theme);
        int background = Color.parseColor(dark ? "#101a17" : "#fcfcf9");
        content.setBackgroundColor(background);
        web.setBackgroundColor(background);
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(background));
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark);
        getSharedPreferences("appearance", MODE_PRIVATE).edit().putString("theme", theme).apply();
    }
    private void showUpdateDialog() {
        try {
            UpdateManifest update = UpdateManager.candidate(this);
            if (update == null || updateDialogVisible) return;
            boolean ru = "ru".equals(getResources().getConfiguration().getLocales().get(0).getLanguage());
            updateDialogVisible = true;
            new AlertDialog.Builder(this).setTitle("Daymark " + update.version)
                .setMessage((ru ? "Обновите приложение. Локальные данные сохранятся. Android попросит подтвердить установку." : "Update the app. Your saved data is retained. Android will ask you to confirm installation.") + "\n\n" + update.notes)
                .setPositiveButton(ru ? "Обновить" : "Update", (dialog, which) -> { try { UpdateManager.download(this); } catch (Exception ignored) { } })
                .setNegativeButton(ru ? "Позже" : "Later", null).setOnDismissListener(dialog -> updateDialogVisible = false).show();
        } catch (Exception ignored) { }
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if (intent.getBooleanExtra("showUpdates", false)) showUpdateDialog();
    }
    private void reply(JavaScriptReplyProxy reply, String id, JSONObject result, String error) {
        try { JSONObject response = new JSONObject().put("id", id); if (error == null) response.put("result", result); else response.put("error", error); reply.postMessage(response.toString()); } catch (Exception ignored) { }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 43) UpdateManager.prefs(this).edit().remove("installing").apply();
        if (request == 44 && result == RESULT_OK && data != null && data.getData() != null) {
            Uri uri = data.getData();
            offlineExecutor.execute(() -> {
                String message;
                try (java.io.InputStream input = getContentResolver().openInputStream(uri)) {
                    LegacyBackup.restore(this, input); message = "Backup restored. Sign in to the same account to use your saved data.";
                } catch (Exception error) { message = "Could not restore the backup. Use the Daymark 0.2 export and restore before signing in."; }
                UpdateManager.prefs(this).edit().putString("importMessage", message).commit();
                runOnUiThread(() -> { if (!isDestroyed() && web != null) web.evaluateJavascript("window.dispatchEvent(new Event('daymark:updates'))", null); });
            });
        }
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 41 && permissionReply != null) {
            try { JSONObject status = ReminderService.status(this); if (!ReminderService.allowed(this)) status.put("permission", "denied"); reply(permissionReply, permissionId, status, null); } catch (JSONException ignored) { }
            permissionReply = null;
        }
        if (request == 42 && updatePermissionReply != null) {
            try { reply(updatePermissionReply, updatePermissionId, UpdateManager.status(this), null); } catch (Exception ignored) { }
            updatePermissionReply = null;
        }
    }
    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        UpdateManager.prefs(this).edit().remove("installing").apply();
        try { ReminderService.reschedule(this); } catch (JSONException ignored) { }
        if (OfflineStore.get(this).active() != null) SyncWorker.schedule(this, true);
        UpdateManager.schedule(this);
        if (UpdateManager.prefs(this).getBoolean("awaitingPermission", false)) {
            boolean allowed = getPackageManager().canRequestPackageInstalls();
            UpdateManager.prefs(this).edit().remove("awaitingPermission").putBoolean("installRequested", allowed)
                .putString("error", allowed ? "" : "Allow Daymark to install updates in Android settings, then try again.").apply();
        }
        updateHandler.removeCallbacks(updateTick); updateHandler.post(updateTick);
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new Event('focus'))", null);
    }
    @Override protected void onPause() { resumed = false; updateHandler.removeCallbacks(updateTick); super.onPause(); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { updateHandler.removeCallbacksAndMessages(null); updateExecutor.shutdownNow(); offlineExecutor.shutdownNow(); historyExecutor.shutdownNow(); if (web != null) web.destroy(); super.onDestroy(); }
}
