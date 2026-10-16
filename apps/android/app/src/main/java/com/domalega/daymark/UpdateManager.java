package com.domalega.daymark;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.work.*;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.json.*;

final class UpdateManager {
    static final String CHANNEL = "daymark-updates", DOWNLOAD = "daymark-update-download";
    static final int NOTIFICATION = 7402;
    static android.content.SharedPreferences prefs(Context c) { return c.getSharedPreferences("daymark-updates", Context.MODE_PRIVATE); }
    static File apk(Context c) { return new File(new File(c.getFilesDir(), "updates"), "update.apk"); }
    static UpdateManifest candidate(Context c) throws Exception {
        String value = prefs(c).getString("candidate", null);
        return value == null ? null : new UpdateManifest(new JSONObject(value));
    }
    static synchronized void cleanInstalled(Context c) {
        try {
            UpdateManifest update = candidate(c);
            if (update != null && update.code <= BuildConfig.VERSION_CODE) {
                prefs(c).edit().remove("candidate").remove("ready").remove("error").remove("installRequested").remove("progress").commit();
                apk(c).delete(); new File(apk(c).getParentFile(), "update.part").delete();
                c.getSystemService(NotificationManager.class).cancel(NOTIFICATION);
            }
        } catch (Exception ignored) { prefs(c).edit().remove("candidate").apply(); }
    }
    static JSONObject status(Context c) throws Exception {
        android.content.SharedPreferences p = prefs(c); UpdateManifest update = candidate(c);
        return new JSONObject().put("installedVersion", BuildConfig.VERSION_NAME).put("installedCode", BuildConfig.VERSION_CODE)
            .put("candidate", update == null ? JSONObject.NULL : update.json()).put("checkedAt", p.getLong("checkedAt", 0))
            .put("downloading", p.getBoolean("downloading", false)).put("progress", p.getInt("progress", 0))
            .put("ready", update != null && p.getInt("ready", 0) == update.code && apk(c).isFile())
            .put("error", p.getString("error", "")).put("notifications", notificationsAllowed(c))
            .put("canImportLegacy", LegacyBackup.canImport(c)).put("importMessage", p.getString("importMessage", ""));
    }
    static void schedule(Context c) {
        cleanInstalled(c);
        Constraints network = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager manager = WorkManager.getInstance(c);
        manager.enqueueUniquePeriodicWork("daymark-update-daily", ExistingPeriodicWorkPolicy.KEEP,
            new PeriodicWorkRequest.Builder(UpdateCheckWorker.class, 1, TimeUnit.DAYS).setConstraints(network).build());
        if (System.currentTimeMillis() - prefs(c).getLong("checkedAt", 0) > TimeUnit.HOURS.toMillis(6))
            manager.enqueueUniqueWork("daymark-update-check", ExistingWorkPolicy.KEEP,
                new OneTimeWorkRequest.Builder(UpdateCheckWorker.class).setConstraints(network).build());
    }
    static void check(Context c) throws Exception {
        // Releases/latest excludes prereleases. Read the preview channel explicitly.
        JSONArray releases = new JSONArray(UpdateHttp.json("https://api.github.com/repos/Domalega/diploma/releases?per_page=30"));
        UpdateManifest best = UpdateDiscovery.find(releases, BuildConfig.VERSION_CODE, Build.VERSION.SDK_INT, UpdateHttp::json);
        synchronized (UpdateManager.class) {
        UpdateManifest previous = candidate(c);
        android.content.SharedPreferences.Editor edit = prefs(c).edit().putLong("checkedAt", System.currentTimeMillis()).remove("error");
        // Keep the selected version fixed while a user-requested download/install is in flight.
        if (!prefs(c).getBoolean("downloading", false) && !prefs(c).getBoolean("installRequested", false)) {
            if (best == null) { edit.remove("candidate").remove("ready"); apk(c).delete(); }
            else if (previous == null || best.code != previous.code) { edit.putString("candidate", best.json().toString()).remove("ready"); apk(c).delete(); }
        }
        edit.commit();
        if (best != null && prefs(c).getInt("notified", 0) < best.code && notify(c, false)) prefs(c).edit().putInt("notified", best.code).apply();
        }
    }
    static boolean notify(Context c, boolean ready) throws Exception {
        if (!ReminderService.allowed(c)) return false;
        UpdateManifest update = candidate(c); if (update == null) return false;
        NotificationManager manager = c.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Daymark — обновления / updates", NotificationManager.IMPORTANCE_DEFAULT));
        if (manager.getNotificationChannel(CHANNEL).getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("showUpdates", true);
        PendingIntent intent = PendingIntent.getActivity(c, NOTIFICATION, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        boolean ru = "ru".equals(c.getResources().getConfiguration().getLocales().get(0).getLanguage());
        String title = ready ? (ru ? "Обновление готово к установке" : "Update ready to install") : (ru ? "Доступен Daymark " : "Daymark available: ") + update.version;
        String text = ru ? "Откройте приложение, чтобы обновить его. Данные сохранятся." : "Open the app to update. Your saved data is retained.";
        manager.notify(NOTIFICATION, new Notification.Builder(c, CHANNEL).setSmallIcon(com.domalega.daymark.R.drawable.ic_daymark)
            .setContentTitle(title).setContentText(text).setContentIntent(intent).setAutoCancel(true).build());
        return true;
    }
    static boolean notificationsAllowed(Context c) {
        if (!ReminderService.allowed(c)) return false;
        NotificationChannel channel = c.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
    static synchronized void download(Context c) throws Exception {
        UpdateManifest update = candidate(c);
        if (update == null || !update.newerThan(BuildConfig.VERSION_CODE, Build.VERSION.SDK_INT)) throw new IOException("No newer update is available");
        prefs(c).edit().putBoolean("installRequested", true).remove("error").commit();
        if (prefs(c).getInt("ready", 0) == update.code && apk(c).isFile()) return;
        prefs(c).edit().putBoolean("downloading", true).putInt("progress", 0).commit();
        WorkManager.getInstance(c).enqueueUniqueWork(DOWNLOAD, ExistingWorkPolicy.KEEP,
            new OneTimeWorkRequest.Builder(UpdateDownloadWorker.class).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build());
    }
    static void verify(Context c, File file, UpdateManifest update) throws Exception {
        if (file.length() != update.size) throw new SecurityException("Update size mismatch");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) { byte[] buffer = new byte[65536]; int n; while ((n = input.read(buffer)) != -1) digest.update(buffer, 0, n); }
        if (!hex(digest.digest()).equals(update.sha256)) throw new SecurityException("Update checksum mismatch");
        PackageManager pm = c.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo installed = pm.getPackageInfo(c.getPackageName(), flags), archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        if (archive == null || !c.getPackageName().equals(archive.packageName) || version(archive) != update.code
            || !update.version.equals(archive.versionName) || version(archive) <= version(installed)
            || archive.applicationInfo == null || archive.applicationInfo.minSdkVersion > Build.VERSION.SDK_INT
            || !signatures(installed).equals(signatures(archive))) throw new SecurityException("Update package or signing certificate mismatch");
    }
    private static long version(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private static Set<String> signatures(PackageInfo info) throws Exception {
        android.content.pm.Signature[] values = Build.VERSION.SDK_INT >= 28 && info.signingInfo != null ? info.signingInfo.getApkContentsSigners() : info.signatures;
        if (values == null || values.length == 0) throw new SecurityException("Unsigned update");
        Set<String> result = new HashSet<>(); for (android.content.pm.Signature value : values) result.add(hex(MessageDigest.getInstance("SHA-256").digest(value.toByteArray()))); return result;
    }
    static String hex(byte[] values) { StringBuilder out = new StringBuilder(); for (byte value : values) out.append(String.format(Locale.ROOT, "%02x", value & 255)); return out.toString(); }
    static Intent installerIntent(Context c) {
        Uri uri = FileProvider.getUriForFile(c, c.getPackageName() + ".updates", apk(c));
        Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).putExtra(Intent.EXTRA_RETURN_RESULT, true);
        intent.setClipData(ClipData.newRawUri("Daymark update", uri)); return intent;
    }
    static void install(Activity activity) throws Exception {
        UpdateManifest update = candidate(activity);
        if (update == null || prefs(activity).getInt("ready", 0) != update.code) return;
        verify(activity, apk(activity), update);
        prefs(activity).edit().putBoolean("installRequested", false).commit();
        if (!activity.getPackageManager().canRequestPackageInstalls()) {
            prefs(activity).edit().putBoolean("awaitingPermission", true).commit();
            activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))); return;
        }
        activity.startActivityForResult(installerIntent(activity), 43);
    }
}
