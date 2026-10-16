# Android updates

Starting with 0.3.0, Daymark checks for new versions on launch (at most once every six hours) and approximately daily in the background. You can also check manually in **Settings → App updates**. A notification and an in-app banner offer the update. Downloads start only after you press the button; WorkManager retries an interrupted download up to three times. Android may postpone background work to save battery.

After downloading, the app verifies the APK's size, SHA-256 checksum, package name, version, and signing certificate against the installed app. The first time you install an update through Daymark, allow it to install APKs in Android settings. Android then asks you to confirm installation. Canceling keeps the existing version and data. Regular updates from 0.3.0 onward do not require uninstalling: the local database, pending changes, and settings stay on the device.

Update notifications require notification permission. Without it, available updates still appear inside the app. Each new version is announced once; a downloaded update has a separate ready-to-install notification. Reopen Daymark after force-stopping it to resume background checks.

## First upgrade from 0.2.0

The signing key for the old 0.2.0 preview was not retained: its build log confirms that the key file was missing when the cache was saved. Android therefore cannot install 0.3.0 over 0.2.0. Starting with 0.3.0, a permanent key is stored in protected GitHub Actions secrets. This signing identity change is a one-time migration.

If all your records are already on the server, uninstall 0.2.0, install 0.3.0, and sign in again. To save pending changes first, open 0.2.0 online, press **Sync now**, wait for a successful exchange with no pending changes, and verify your records on the website. Repeat for each account you used.

If synchronization is unavailable or you want a separate local backup, use the export tool:

1. Keep 0.2.0 installed. Install Python 3 and [Android SDK Platform-Tools](https://developer.android.com/tools/releases/platform-tools) on your computer. Connect the phone over USB, enable USB debugging, and authorize the computer. `adb devices` should list exactly one available phone.
2. Download `android-export-legacy.py` from the release and run `python android-export-legacy.py daymark-0.2-backup.json`. You can pass `--adb C:\path\to\adb.exe`. The script stops the app, exports its local data, and verifies the backup. It does not uninstall the app or clear its storage. An existing backup file is never overwritten.
3. Confirm that the script reports `Saved and verified`. Copy the JSON file to the phone, for example into Downloads. The file contains personal records; keep it private as a backup.
4. Uninstall 0.2.0 and install the 0.3.0 APK.
5. **Before signing in for the first time**, press **Restore a 0.2 backup** on the sign-in screen and select the JSON file. Wait for the successful restoration message.
6. Sign in to the same account. Your local records and pending changes are available again. Accounts are restored separately. If a record conflicts with the server, choose which version to keep.

The backup transfers local calendar, to-do, Kanban, and medication documents, the upload queue, and conflict information. It excludes passwords and sign-in tokens. Language, appearance, and Android permissions must be configured again during this one-time migration. You can disable USB debugging afterward. Regular subsequent updates do not require a computer or this procedure.

Restoration is allowed only into empty storage before the first sign-in. Invalid files are rejected, and all documents are inserted in one transaction. Calendar synchronization still requires an available `/api/sync` endpoint; APK updates use GitHub independently of that API.

## Building and publishing future versions

Increment both `versionCode` and `versionName` in `apps/android/version.properties`. Keep the same `applicationId` and signing key. **Native apps** reads `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` from repository secrets and builds a signed release APK without debugging enabled. The key is excluded from caches and artifacts. Losing it would make future updates incompatible again; an encrypted local recovery backup was created when 0.3.0 was configured.

Every preview-channel Android release must use the tag `native-preview-X.Y.Z` and include three matching files: `Daymark-Android-X.Y.Z.apk`, `android-update.json`, and `SHA256SUMS.txt`. `scripts/package-android-update.cjs` generates them from the APK and its actual `aapt` metadata. Update `apps/android/release-notes.txt` for each version; `DAYMARK_UPDATE_NOTES` can override this text. The app reads published releases, including prereleases: `releases/latest` excludes them. Prepare a draft, verify its assets, and then publish it. Increase the version for subsequent builds instead of replacing an already published APK or manifest.

CI covers scheduling, merging, and update selection; instrumented database, Keystore, trusted WebView, signing, and damaged-APK checks; export from an actual 0.2.0 installation and restoration into the release APK; and installation of a test next version through Android's system installer while retaining the local queue and encrypted session. Battery restrictions on specific phone models require on-device validation.
