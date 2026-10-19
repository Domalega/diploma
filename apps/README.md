# Daymark device clients

Android bundles the interface and supports offline notes, tasks, Kanban and medication marks after the first online sign-in. See [offline storage and sync](../docs/OFFLINE_SYNC.md).

Windows opens the hosted website; editing requires internet access. Both clients save timed note and medication reminders on the device, so alerts can run with the app closed.

## Install and enable

- **Android 8+:** install the preview APK, sign in and enable notifications in Settings. Allow **Alarms & reminders** for precise timing. Keep Android System WebView updated. For updates and migration from 0.2.0, see [Android updates](../docs/ANDROID_UPDATES.md).
- **Windows 10 2004+ / Windows 11 x64:** extract the preview ZIP into a permanent folder and run `Daymark.exe`. Microsoft Edge WebView2 Runtime is required. Keep the folder in place: the local reminder task uses that executable.
- Use **Test notification**, then close the app. An alert is scheduled five seconds later.
- **Disable device reminders** or sign out to cancel schedules. Before removing Windows files, disable reminders or run `Daymark.exe --clear`.

Downloads are available in GitHub Actions artifacts and [Releases](https://github.com/Domalega/diploma/releases). Both clients are previews; Windows binaries are unsigned.

## Reminder behavior

Times follow the device clock. Medication weekdays, course dates and saved intake marks are respected; simultaneous medication alerts are grouped. All-day notes appear when the calendar opens. Android periodically syncs remote changes; Windows refreshes them when opened online. Until then, saved offline reminders may reflect older data.

Android restores alarms after reboot, app update and clock changes. Force-stop, blocked notifications and battery restrictions can prevent delivery; reopen the app after force-stopping it. Without exact-alarm permission, alerts may be delayed.

Windows schedules eight days ahead. A local task refills the schedule hourly and at sign-in while the user is signed in. Clock changes apply on the next refill or app activation. Neither platform can deliver while powered off; Windows may drop alerts during long sleep periods. Focus/Do Not Disturb settings still apply.

Android uses private storage with backup disabled and Keystore encryption for sync credentials. Windows encrypts reminder snapshots with the user's DPAPI key. Reminder snapshots contain no account tokens. Native messaging is restricted to the Android bundled interface or the Windows Daymark page.

## Build

The **Native apps** workflow builds both previews and runs native tests. Build artifacts and signing keys are excluded from Git.

**Android:** JDK 17, Android SDK 35 and Gradle 8.11.1. First [build the bundled interface](../docs/OFFLINE_SYNC.md#build-and-verify), then run:

```sh
gradle -p apps/android testDebugUnitTest assembleDebug
```

**Windows:** .NET SDK 8 on Windows:

```powershell
dotnet run --project apps/windows/ScheduleTests
dotnet publish apps/windows/Daymark -c Release -r win-x64 --self-contained true -o dist/windows
```
