package com.domalega.daymark;

import android.content.Context;
import androidx.work.*;
import java.util.concurrent.TimeUnit;

public class SyncWorker extends Worker {
    public SyncWorker(Context context, WorkerParameters parameters) { super(context, parameters); }
    private static Constraints constraints() { return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(); }
    static void schedule(Context context, boolean immediate) {
        try {
        WorkManager manager = WorkManager.getInstance(context);
        manager.enqueueUniquePeriodicWork("daymark-sync-hourly", ExistingPeriodicWorkPolicy.KEEP,
            new PeriodicWorkRequest.Builder(SyncWorker.class, 1, TimeUnit.HOURS).setConstraints(constraints()).build());
        if (immediate) manager.enqueueUniqueWork("daymark-sync-now", ExistingWorkPolicy.APPEND_OR_REPLACE,
            new OneTimeWorkRequest.Builder(SyncWorker.class).setInitialDelay(2, TimeUnit.SECONDS).setConstraints(constraints()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build());
        } catch (RuntimeException error) {
            // The outbox is durable; retry scheduling on the next app activation.
            android.util.Log.e("Daymark", "Could not schedule background exchange", error);
        }
    }
    static void cancel(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork("daymark-sync-hourly");
        WorkManager.getInstance(context).cancelUniqueWork("daymark-sync-now");
    }
    @Override public Result doWork() {
        try {
            OfflineStore store = OfflineStore.get(getApplicationContext());
            org.json.JSONObject doc = store.read(store.active());
            if (doc != null && doc.has("state") && doc.has("lastSync") && !doc.has("flight") && java.time.Instant.parse(doc.getString("lastSync")).isAfter(java.time.Instant.now().minusSeconds(10)) && SyncMerge.changes(doc.getJSONObject("base"), doc.getJSONObject("state")) == 0) return Result.success();
            OfflineSync.run(getApplicationContext()); return Result.success();
        }
        catch (OfflineHttp.Failure error) { return error.status >= 500 || error.status == 429 ? Result.retry() : Result.failure(); }
        catch (Exception error) { return Result.retry(); }
    }
}
