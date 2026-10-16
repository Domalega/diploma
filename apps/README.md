# Daymark device reminders

Android 0.2.0 bundles the interface and keeps account data in local SQLite storage. After the first online sign-in, notes, to-do tasks, Kanban and medication marks work offline; changes exchange with the server on connectivity, app activation, manually and approximately hourly in the background. Conflicting edits show both versions for an explicit choice. See [local storage and exchange](../docs/OFFLINE_SYNC.md) for behavior, build steps and validation.

Windows opens the existing Daymark website and saves a local copy of timed note and medication schedules. Saved reminders on both platforms run with the app and browser closed, without a notification server or push subscription. Windows calendar editing still requires an internet connection and the existing API.

## Install and enable

- Android 8+: install the preview APK, open Daymark, sign in, and enable notifications in Settings. Allow **Alarms & reminders** for precise timing. Keep Android System WebView updated.
- Windows 10 2004+ / Windows 11 x64: extract the ZIP into a permanent folder and open `Daymark.exe`. Microsoft Edge WebView2 Runtime is required. Enable notifications in Settings. Keep the extracted folder in place: the local Windows task runs this executable to replenish scheduled notifications.
- Use **Test notification**, then close the app. A test notification is scheduled five seconds later.
- **Disable device reminders** cancels schedules on that device. Signing out also removes the saved plan and schedules. Before removing the Windows files, disable device reminders or run `Daymark.exe --clear`.

Both downloads are previews. The Android APK uses a development signing key; replacing it with a build signed using a different key requires uninstalling the previous preview. Windows binaries are unsigned. No installer, administrator rights, store account, or subscription is needed.

## Behavior and limits

- Times follow the device's local clock. Medication weekdays, course boundaries, and saved intake marks are respected. Medication reminders due together are grouped. Past reminders are not replayed.
- All-day notes keep their existing on-open behavior; they do not get an invented alarm time.
- Android exchanges changes periodically even with the interface closed; Windows receives changes when Daymark opens online. An intake mark made elsewhere cannot suppress an already saved offline reminder until synchronization.
- Android schedules the next alarm and reschedules from the saved rules after delivery, reboot, app update, and clock or timezone changes. Force-stopping the app, blocking notifications, locking Android Private Space, or vendor battery restrictions can prevent delivery. Reopen the app after a force-stop. Without exact-alarm permission, timing may be delayed.
- Windows schedules eight days ahead. A per-user local task refills the schedule hourly and at sign-in, without internet. The app need not remain running. This task runs only while the user is signed in; Windows may drop notifications if the computer is off or asleep for too long. Clock changes are reflected on the next refill or app activation.
- No notification mechanism can alert while the device is powered off. System Focus/Do Not Disturb settings still apply.
- Android stores data in app-private storage with backup disabled and encrypts its background sync session using Android Keystore. Windows protects its reminder snapshot with the current user's DPAPI key. Reminder snapshots contain no account tokens.
- Native messaging is restricted to the main frame at the bundled Android asset origin or the Windows Daymark HTTPS page. Other links open in the external browser. Permissions are requested by user action.

## Build

The **Native apps** GitHub Actions workflow builds both previews and runs native scheduling checks. Build artifacts, SDKs, local state, and signing keys are ignored by Git.

Android: JDK 17, Android SDK 35 and Gradle 8.11.1. First [build the bundled interface](../docs/OFFLINE_SYNC.md#build-and-verify), then run:

```sh
gradle -p apps/android testDebugUnitTest assembleDebug
```

Windows: .NET SDK 8 on Windows:

```powershell
dotnet run --project apps/windows/ScheduleTests
dotnet publish apps/windows/Daymark -c Release -r win-x64 --self-contained true -o dist/windows
```

The Windows task and native notification registration are created only when reminders are enabled. Reminder rules are renewed from the device snapshot, not by an external scheduler.
