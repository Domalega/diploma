package com.domalega.daymark;

import android.content.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.security.MessageDigest;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class UpdateSecurityTest {
    static UpdateManifest fixture(Context c) throws Exception {
        File file = UpdateManager.apk(c); file.getParentFile().mkdirs();
        try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("future.apk"); OutputStream output = new FileOutputStream(file)) {
            byte[] buffer = new byte[65536]; int n; while ((n = input.read(buffer)) != -1) output.write(buffer, 0, n);
        }
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) { byte[] buffer = new byte[65536]; int n; while ((n = input.read(buffer)) != -1) hash.update(buffer, 0, n); }
        try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("future.json"); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int n; while ((n = input.read(buffer)) != -1) bytes.write(buffer, 0, n);
            UpdateManifest update = new UpdateManifest(new JSONObject(bytes.toString("UTF-8")));
            assertEquals(file.length(), update.size); assertEquals(UpdateManager.hex(hash.digest()), update.sha256); return update;
        }
    }
    @Test public void signedNewerApkIsVerifiedAndInstallerCanReadOnlyTheUpdateDirectory() throws Exception {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        UpdateManifest update = fixture(c);
        try {
            UpdateManager.verify(c, UpdateManager.apk(c), update);
            Intent intent = UpdateManager.installerIntent(c);
            assertEquals("content", intent.getData().getScheme());
            assertNotNull(c.getPackageManager().resolveActivity(intent, 0));
            try (InputStream input = c.getContentResolver().openInputStream(intent.getData())) { assertNotNull(input); assertEquals('P', input.read()); }
            try { androidx.core.content.FileProvider.getUriForFile(c, c.getPackageName() + ".updates", new File(c.getFilesDir(), "private-credentials")); fail("Private files must never be shared"); }
            catch (IllegalArgumentException expected) { }
            try (RandomAccessFile file = new RandomAccessFile(UpdateManager.apk(c), "rw")) { file.seek(100); file.writeByte(file.readByte() ^ 1); }
            UpdateManager.prefs(c).edit().putString("candidate", update.json().toString()).putInt("ready", update.code).putBoolean("installRequested", true).commit();
            try { UpdateManager.verify(c, UpdateManager.apk(c), update); fail("Tampered update must fail verification"); }
            catch (SecurityException expected) { UpdateManager.installFailed(c, expected); }
            assertFalse("A bad cached APK must be downloadable again", UpdateManager.status(c).getBoolean("ready"));
            assertFalse(UpdateManager.apk(c).exists());
            assertFalse(UpdateManager.prefs(c).getBoolean("installRequested", true));
        } finally { UpdateManager.apk(c).delete(); UpdateManager.prefs(c).edit().clear().commit(); }
    }
    @Test public void wrongVersionIsRejectedEvenWithTheCorrectHash() throws Exception {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        UpdateManifest update = fixture(c);
        try {
            UpdateManifest fake = new UpdateManifest(update.json().put("versionCode", update.code + 1));
            try { UpdateManager.verify(c, UpdateManager.apk(c), fake); fail("Manifest version must match APK"); } catch (SecurityException expected) { }
        } finally { UpdateManager.apk(c).delete(); }
    }
    @Test public void aDifferentSigningKeyCannotSupplyAnUpdate() throws Exception {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        UpdateManifest update = fixture(c);
        File file = UpdateManager.apk(c);
        try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("untrusted.apk"); OutputStream output = new FileOutputStream(file)) {
            byte[] buffer = new byte[65536]; int n; while ((n = input.read(buffer)) != -1) output.write(buffer, 0, n);
        }
        try {
            MessageDigest hash = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new FileInputStream(file)) { byte[] buffer = new byte[65536]; int n; while ((n = input.read(buffer)) != -1) hash.update(buffer, 0, n); }
            UpdateManifest untrusted = new UpdateManifest(update.json().put("size", file.length()).put("sha256", UpdateManager.hex(hash.digest())));
            try { UpdateManager.verify(c, file, untrusted); fail("An APK signed with another key must be rejected"); } catch (SecurityException expected) { }
        } finally { file.delete(); }
    }
}
