# Android local storage and exchange

Android 0.2.0 bundles the React interface in its APK and serves it through `WebViewAssetLoader` at the app's private asset origin. A first online sign-in downloads the account data. Subsequent launches, note/task edits, to-do completion, Kanban changes and medication marks read and write the app-private SQLite database. Website and Windows behavior are unchanged.

The database keeps a server baseline, the current local state, a generation counter, and a durable in-flight upload. Their difference is the outbox. A worker sends it on connectivity, app activation, manual exchange, and approximately hourly. WorkManager controls background timing and retries; force-stop and battery restrictions can postpone exchange. The UI shows pending changes, last successful exchange, connection/authentication errors and conflicting versions.

Each note, task or intake is an independent merge unit. Board/column settings and the medication schedule are separate settings units. Independent changes merge; concurrent edits of the same unit, including deletion versus editing, require an explicit phone/server choice. Referential or WIP conflicts include the affected settings and related units. Conflicts preserve local data and stop automatic exchange until resolved. Identical intake marks converge even when their recorded times differ.

The server serializes sync and ordinary web writes using the account row lock. SQLite development writes use a process queue as well. Upload receipts commit in the same transaction as data; replaying the same operation ID and payload returns current data without applying it again. Reusing an operation ID with a different payload is rejected. Existing numeric note IDs remain intact; an additive identity table supplies stable UUIDs to offline clients. No destructive migration is used.

Native sync rebases edits made during an upload over its reply before saving. Generation checks reject a local write based on an obsolete snapshot. HTTP errors retain local changes; unknown network outcomes retain the same in-flight request for safe retry. Existing Kanban history remains; an exchange adds an activity entry for each task's resulting change. Multiple offline edits to one task are combined into that resulting change.

Background exchange refreshes native alarm rules from the complete local snapshot, including remote medication marks. Alarm failures do not turn a committed calendar write into a failed save. All-day notices continue to display only when the calendar opens.

Accounts have separate SQLite documents. Signing out removes the active credentials and stops that account's work, while retaining its pending data for the next verified sign-in to the same account. A different account cannot read or upload those changes. Session credentials used by background workers are encrypted with Android Keystore AES-GCM; native bridge responses never contain encrypted credential storage. A revoked/expired session stops network exchange and prompts sign-in while the local calendar remains available. Clearing Android app storage or uninstalling removes local data, so pending edits should be exchanged first. Updating an installed app requires an APK signed with the same signing key.

## Build and verify

Build the bundled UI before Gradle:

```powershell
$env:PUBLIC_URL = '.'
$env:REACT_APP_ROUTER = 'hash'
$env:REACT_APP_API_URL = 'https://diploma-api-zozr.onrender.com/api'
npm ci --prefix client
npm run build --prefix client
gradle -p apps/android testDebugUnitTest assembleDebug
```

The Native apps workflow performs these steps and runs emulator checks for alarms, bundled assets, account isolation, local persistence and Keystore credentials. Install the resulting `Daymark-Android-preview` APK after deploying the API with `/api/sync`. The asset origin changes from the website to the bundled app, so the first launch of this version requires an online sign-in. Automatic exchange never creates accounts or copies one account's queue to another.

Manual acceptance: sign in online; disconnect; create, edit, complete and delete items; force-close and reopen; reconnect and compare with the website. Also edit the same item on the website while the phone is offline, verify both versions are shown, and resolve the conflict. Repeat for medication marks and check that deleted or already taken items do not produce stale alarms. Background execution timing and a real phone's battery restrictions require on-device validation.
