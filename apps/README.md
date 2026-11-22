# Jotstride for Android and Windows

English · [Русский](../docs/ru/APPS.md)

The Android app can work offline after you sign in online once. The Windows app bundles the calendar interface. On Windows, you can view previously saved calendar data and edit an unlocked, locally saved encrypted calendar offline. Signing in and synchronizing changes require a connection to the API. Both apps save timed reminders on the device so they can alert you with the app closed.

## Install and enable

Get the preview builds from [GitHub Releases](https://github.com/Domalega/diploma/releases) or from the **Native apps** workflow artifacts.

- **Android 8 or later.** Install the preview APK and sign in. Keep Android System WebView up to date. For upgrades from 0.2.0, follow the [migration guide](../docs/ANDROID_UPDATES.md#first-upgrade-from-020) before you uninstall anything.
- **Windows 10 version 2004 or later, or Windows 11 (x64).** Install Microsoft Edge WebView2 Runtime if you need it. Extract the preview ZIP to a permanent folder and run `Daymark.exe`. The Windows build is unsigned. Keep the folder in place because the scheduled reminder task runs the executable from that location.

### Test reminders with the app closed

1. Open **Settings** and enable notifications. On Android, allow **Alarms & reminders** in system settings for precise timing.
2. Select **Test notification** and close the app. You should receive an alert five seconds after selecting the button.
3. If the alert doesn't arrive, check the system notification settings and the delivery conditions below.

To cancel reminders on this device, select **Disable device reminders** or sign out. Before removing the Windows app files, disable reminders or run `Daymark.exe --clear`.

## Reminder behavior

Reminders follow the device clock. Jotstride groups medication alerts scheduled for the same time and uses the saved weekdays, course dates and intake marks. All-day notes show a reminder when you open the calendar.

- **Android** refreshes reminders after background sync and restores alarms after a reboot, an app update or a clock change. Android can delay alerts when precise alarms are unavailable. Notification settings and battery restrictions can also affect delivery. After a force-stop, open Jotstride again.
- **Windows** schedules reminders eight days ahead. A local task refills the schedule hourly and at sign-in while a user session is active. Clock changes take effect on the next refill or when you open the app. Open Jotstride online to fetch changes from other devices. Windows may skip alerts during long sleep periods.

A powered-off device cannot deliver an alert. Focus and Do Not Disturb settings still apply. Until the next sync, reminders can reflect older data. If you use end-to-end encryption, keep the app open while it syncs changes from other devices.

### Where the apps store data

On Android, notes, tasks, Kanban and medication records are available [offline](../docs/OFFLINE_SYNC.md). App data lives in private storage with backup disabled. Android Keystore protects native account documents, reminder plans and sync credentials. On Windows, DPAPI protects reminder snapshots under the Windows user account. Reminder snapshots contain no account tokens.

Native messages are available only to the bundled Android interface or the Jotstride page in the Windows app. Android 0.4.1 and the updated Windows client support native protection for [end-to-end encryption keys](../docs/ENCRYPTION.md).

## Build

The **Native apps** workflow builds both previews and runs native tests. Keep build artifacts and signing keys out of Git.

### Android

Install Node.js 22 or newer, npm, JDK 17, Android SDK 35 and Gradle 8.11.1. From the repository root, build the web interface first, then run the unit tests and build the debug APK. Use an API address that supports `/api/sync`.

```powershell
$env:PUBLIC_URL = '.'
$env:REACT_APP_ROUTER = 'hash'
$env:REACT_APP_API_URL = 'https://diploma-api-zozr.onrender.com/api'
npm ci --prefix client
npm run build --prefix client
gradle -p apps/android testDebugUnitTest assembleDebug
```

### Windows

Install Node.js 22 or newer and the .NET 8 SDK on Windows. From the repository root, build the bundled interface, run the scheduler tests and publish the x64 build.

```powershell
$env:BUILD_PATH = '../dist/windows-web'
$env:PUBLIC_URL = '.'
$env:REACT_APP_ROUTER = 'hash'
$env:REACT_APP_API_URL = 'https://diploma-api-zozr.onrender.com/api'
npm ci --prefix client
npm run build --prefix client
dotnet run --project apps/windows/ScheduleTests
dotnet publish apps/windows/Daymark -c Release -r win-x64 --self-contained true -o dist/windows
```
