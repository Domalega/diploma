package com.domalega.daymark;

import android.content.Context;
import androidx.work.*;
import java.io.*;
import java.net.HttpURLConnection;

public class UpdateDownloadWorker extends Worker {
    public UpdateDownloadWorker(Context c, WorkerParameters p) { super(c, p); }
    @Override public Result doWork() {
        Context c = getApplicationContext(); File target = UpdateManager.apk(c), part = new File(target.getParentFile(), "update.part");
        HttpURLConnection connection = null;
        try {
            UpdateManifest update = UpdateManager.candidate(c);
            if (update == null || update.code <= BuildConfig.VERSION_CODE) throw new SecurityException("Update is no longer applicable");
            if (!target.getParentFile().isDirectory() && !target.getParentFile().mkdirs()) throw new IOException("No update storage");
            if (target.getParentFile().getUsableSpace() < update.size * 2) throw new IOException("Not enough free space");
            connection = UpdateHttp.open(update.url);
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(part)) {
                byte[] buffer = new byte[65536]; int n, progress = -1; long received = 0;
                while ((n = input.read(buffer)) != -1) {
                    if (isStopped()) throw new IOException("Download interrupted");
                    received += n; if (received > update.size) throw new SecurityException("Update exceeds declared size");
                    output.write(buffer, 0, n);
                    int next = (int) (received * 100 / update.size);
                    if (next != progress) { progress = next; UpdateManager.prefs(c).edit().putInt("progress", next).apply(); }
                }
                output.getFD().sync();
            }
            UpdateManager.verify(c, part, update);
            if (!part.renameTo(target)) throw new IOException("Cannot save update");
            UpdateManager.prefs(c).edit().putInt("ready", update.code).putBoolean("downloading", false).remove("error").commit();
            UpdateManager.notify(c, true); return Result.success();
        } catch (Exception error) {
            part.delete();
            boolean retry = !(error instanceof SecurityException) && getRunAttemptCount() < 3 && !isStopped();
            UpdateManager.prefs(c).edit().putBoolean("downloading", retry).putInt("progress", 0)
                .putString("error", retry ? "Download interrupted. Retrying when connected." : "Could not download or verify the update. Try again.").commit();
            if (!retry) UpdateManager.prefs(c).edit().putBoolean("installRequested", false).commit();
            return retry ? Result.retry() : Result.failure();
        } finally { if (connection != null) connection.disconnect(); }
    }
}
