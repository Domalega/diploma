package com.domalega.daymark;

import android.content.Context;
import androidx.work.*;

public class UpdateCheckWorker extends Worker {
    public UpdateCheckWorker(Context c, WorkerParameters p) { super(c, p); }
    @Override public Result doWork() {
        try { UpdateManager.check(getApplicationContext()); return Result.success(); }
        catch (Exception error) { return getRunAttemptCount() < 3 ? Result.retry() : Result.failure(); }
    }
}
