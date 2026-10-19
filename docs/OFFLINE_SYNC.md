# Android offline storage and sync

Android bundles the interface and keeps each account's notes, tasks, board and medication data in app-private SQLite storage. The first sign-in requires an internet connection. Later edits work offline and sync when connected, when the app opens, manually through Settings, and approximately hourly in the background. Android may delay background work.

Independent edits merge automatically. Concurrent changes to the same item, including deletion versus editing, require an explicit phone/server choice. Local changes remain available until the conflict is resolved. Signing out stops the account's background work and removes its credentials; its pending data is retained for the next sign-in to the same account. Uninstalling or clearing app storage removes that data.

## Sync contract

Each note, task or intake is a merge unit; board and medication settings are separate units. The local document retains the server baseline, current state, generation and in-flight upload. Edits made during an upload are rebased over its reply. Generation checks reject obsolete local writes; uncertain network outcomes retry the same operation ID.

The API serializes writes per account. Receipts commit with data, making identical upload retries idempotent; reusing an operation ID with another payload is rejected. Existing numeric note IDs are preserved through a separate UUID mapping. Kanban history records each task's resulting change after an exchange.

Android reads send only the requested section across the native bridge. Activity history loads in pages when opened and is cached for offline viewing; background sync omits it. Earlier clients retain the full-history sync response. Deleting a Kanban task removes its activity; deletion versus concurrent editing requires an explicit conflict choice.

Background sync refreshes device reminders from the complete local snapshot. Alarm failures do not undo saved calendar data. Background credentials are encrypted with Android Keystore and excluded from bridge responses. Expired or revoked sessions require sign-in before network sync can resume.

## Build and verify

Build the interface before Gradle:

```powershell
$env:PUBLIC_URL = '.'
$env:REACT_APP_ROUTER = 'hash'
$env:REACT_APP_API_URL = 'https://diploma-api-zozr.onrender.com/api'
npm ci --prefix client
npm run build --prefix client
gradle -p apps/android testDebugUnitTest assembleDebug
```

The API must support `/api/sync`. Native build requirements are listed in [Device clients](../apps/README.md#build).

For acceptance testing, sign in online, disconnect, edit and complete items, close and reopen the app, then reconnect and compare with the website. Edit the same item on both devices and resolve the conflict. Repeat with medication marks and check that deleted or taken items no longer trigger reminders. Background delivery also needs validation on a real phone.
