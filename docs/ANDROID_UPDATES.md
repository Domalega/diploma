# Android updates

English · [Русский](ru/ANDROID_UPDATES.md)

If you're on version 0.3.0 or later, install the update over the existing app. Your local database, pending changes and settings stay on the phone. If you're on 0.2.0, [back up your data before upgrading](#first-upgrade-from-020).

## Install an update

1. In Jotstride, go to **Settings → App updates → Check for updates**. If Jotstride already shows an update banner, you can start there.
2. Select **Download and update**. Jotstride starts the download only when you choose to update. Android's WorkManager can retry a failed download up to three times.
3. When prompted, allow Jotstride to install APKs in Android settings. Then confirm in the Android installer. If you cancel, the current version and its data stay in place.

Jotstride verifies the APK's size, SHA-256 checksum, package name, version and signing certificate before opening the installer.

Jotstride checks at launch if more than six hours have passed since the last successful check. It also schedules a check roughly once a day in the background. Android can delay either background job. Each new version gets one availability notification, and the downloaded APK gets a separate ready-to-install notification. With notifications disabled, updates still appear inside the app. After a force-stop, reopen Jotstride to resume automatic checks.

## First upgrade from 0.2.0

The 0.2.0 preview uses an older signing key. Android requires a one-time reinstall to move to the permanent key. **Keep 0.2.0 installed until you've verified your sync or backup.**

### Option 1. Sync to the server

1. Open 0.2.0 online and select **Sync now**. Wait for a successful sync with no pending changes.
2. Open the website and check that your latest records are there. Repeat for every account you've used on the phone.
3. Uninstall 0.2.0, install the current APK and sign in again.

### Option 2. Export a local backup

Use this option if sync is unavailable or you want a separate copy.

1. On your computer, install Python 3 and [Android SDK Platform-Tools](https://developer.android.com/tools/releases/platform-tools). Connect the phone by USB, enable USB debugging and authorize the computer. Check that `adb devices` lists exactly one available phone.
2. Download `android-export-legacy.py` from the release and run the command below. If `adb` is outside your PATH, add `--adb "C:\path\to\adb.exe"`. The script stops the app and creates a new backup file. It leaves the app and its storage in place and refuses to overwrite an existing backup.

   ```sh
   python android-export-legacy.py daymark-0.2-backup.json
   ```

3. Wait for `Saved and verified`. Copy the JSON file to the phone, for example to Downloads. Keep it private as it contains personal records.
4. Uninstall 0.2.0 and install the current APK.
5. On the sign-in screen, **before signing in**, select **Restore a 0.2 backup** and open the JSON file. Wait for the success message.
6. Sign in to the same account. Check your records and pending changes. If you used multiple accounts, sign in to each in turn. If a record conflicts with the server, choose which version to keep.

The backup includes calendar, to-do, Kanban and medication data, the upload queue and conflict details. It excludes passwords and sign-in tokens. Set your language, appearance and Android permissions again, then turn off USB debugging if you no longer need it. Subsequent updates use the same signing key and install over the app.

The importer checks the file and restores all account documents in one transaction. It runs only in empty app storage before the first sign-in. APK updates come from GitHub independently of the calendar API, which still needs a working `/api/sync` endpoint.

<a name="building-and-publishing-future-versions"></a>

## Build and publish an Android release

1. Increment `versionCode` and `versionName` in [`apps/android/version.properties`](../apps/android/version.properties). Keep the application ID and release signing key.
2. Build the signed, non-debuggable APK with [.github/workflows/native-apps.yml](../.github/workflows/native-apps.yml). The workflow uses the `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` repository secrets. Keep a secure backup of the signing key and keep it out of artifacts and caches. Losing it prevents updates to existing installations.
3. Update [`apps/android/release-notes.txt`](../apps/android/release-notes.txt) before packaging, or set `DAYMARK_UPDATE_NOTES`. The [packaging script](../scripts/package-android-update.cjs) uses the APK's `aapt` metadata to produce the matching release assets.
4. Run the native unit and emulator checks for scheduling, sync, updates and data retention. Test background delivery and battery restrictions on a physical phone.
5. Create a draft release tagged `native-preview-X.Y.Z`. Verify that it contains `Daymark-Android-X.Y.Z.apk`, `android-update.json` and `SHA256SUMS.txt`, then publish it. Keep the legacy export script available for 0.2.0 users. Publish a new version when an APK or manifest needs to change.

The app reads the published release list because GitHub's `releases/latest` endpoint excludes prereleases.
