# Daymark device reminders

Android and Windows clients open the existing Daymark website and save a local copy of timed note and medication schedules. Saved reminders run on the device with the app and browser closed, without a notification server, push subscription, or paid hosting. The calendar UI and account synchronization still need an internet connection and the existing API.

## Install and enable

- Android 8+: install the preview APK, open Daymark, sign in, and enable notifications in Settings. Allow **Alarms & reminders** for precise timing. Keep Android System WebView updated.
- Windows 10 2004+ / Windows 11 x64: extract the ZIP into a permanent folder and open `Daymark.exe`. Microsoft Edge WebView2 Runtime is required. Enable notifications in Settings. Keep the extracted folder in place: the local Windows task runs this executable to replenish scheduled notifications.
- Use **Test notification**, then close the app. A test notification is scheduled five seconds later.
- **Disable device reminders** cancels schedules on that device. Signing out also removes the saved plan and schedules. Before removing the Windows files, disable device reminders or run `Daymark.exe --clear`.

Both downloads are previews. The Android APK uses a development signing key; replacing it with a build signed using a different key requires uninstalling the previous preview. Windows binaries are unsigned. No installer, administrator rights, store account, or subscription is needed.

## Behavior and limits

- Times follow the device's local clock. Medication weekdays, course boundaries, and saved intake marks are respected. Medication reminders due together are grouped. Past reminders are not replayed.
- All-day notes keep their existing on-open behavior; they do not get an invented alarm time.
- Changes made on another device require opening Daymark online on this device. An intake mark made elsewhere cannot suppress an already saved offline reminder until synchronization.
- Android schedules the next alarm and reschedules from the saved rules after delivery, reboot, app update, and clock or timezone changes. Force-stopping the app, blocking notifications, locking Android Private Space, or vendor battery restrictions can prevent delivery. Reopen the app after a force-stop. Without exact-alarm permission, timing may be delayed.
- Windows schedules eight days ahead. A per-user local task refills the schedule hourly and at sign-in, without internet. The app need not remain running. This task runs only while the user is signed in; Windows may drop notifications if the computer is off or asleep for too long. Clock changes are reflected on the next refill or app activation.
- No notification mechanism can alert while the device is powered off. System Focus/Do Not Disturb settings still apply.
- Android stores the snapshot in app-private storage with backup disabled. Windows protects it with the current user's DPAPI key. Native snapshots contain no account tokens. The embedded browser keeps its own signed-in session.
- Native messaging is restricted to Daymark's HTTPS page and main frame. Other links open in the external browser. Permissions are requested by user action.

## Build

The **Native apps** GitHub Actions workflow builds both previews and runs native scheduling checks. Build artifacts, SDKs, local state, and signing keys are ignored by Git.

Android: JDK 17, Android SDK 35 and Gradle 8.11.1:

```sh
gradle -p apps/android testDebugUnitTest assembleDebug
```

Windows: .NET SDK 8 on Windows:

```powershell
dotnet run --project apps/windows/ScheduleTests
dotnet publish apps/windows/Daymark -c Release -r win-x64 --self-contained true -o dist/windows
```

The Windows task and native notification registration are created only when reminders are enabled. Reminder rules are renewed from the device snapshot, not by an external scheduler.
