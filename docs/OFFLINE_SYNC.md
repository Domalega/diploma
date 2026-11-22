# Android offline storage and sync

English · [Русский](ru/OFFLINE_SYNC.md)

You'll need an internet connection the first time you sign in on Android. After that, you can edit notes, tasks, Kanban cards and medication records offline. Jotstride saves each account's changes in the app's private SQLite database.

The steps below describe sync with end-to-end encryption turned off. With [encryption enabled](ENCRYPTION.md#storage-and-synchronization), Jotstride syncs while the calendar is open and can retry saved encrypted changes after you reopen it. Existing server records are preserved. For both account types, Android Keystore protects native account documents and reminder plans.

## Sync your changes

Open Jotstride with a connection or select **Sync now** in **Settings**. Android also schedules a background sync about once an hour when connected. The operating system can delay background work.

If you change different items on two devices, Jotstride merges the changes. If you edit the same item on both devices, or edit it on one and delete it on the other, choose whether to keep the phone or server version. Your local change stays available until you resolve the conflict.

Signing out stops background sync and removes the account's saved credentials. Pending changes remain on the phone for the next sign-in to the same account. Uninstalling the app or clearing its storage removes those local changes.

## Sync contract

- **Merge units.** Each note, task and medication intake can merge independently. Board settings and medication settings are separate units.
- **Local writes.** The app keeps the last server state, the current local state, a generation number and any upload in progress. An edit made during an upload is applied on top of the response. The generation check rejects stale local writes. When a network request has an uncertain outcome, the client retries with the same operation ID.
- **Server writes.** The API serializes writes for each account and saves each operation receipt with its data. Repeating a completed upload with the same ID and payload is safe. The API rejects a different payload with the same ID. A UUID mapping preserves existing numeric note IDs.
- **Kanban history.** The API records the changes for each task after sync. The Android bridge reads only the requested section. It loads history in pages when you open it and caches those pages for offline viewing. Background sync skips history, while older clients can still request the full history in a sync response. Deleting a task removes its activity.
- **Reminders and credentials.** Background sync refreshes reminders from the complete local snapshot. A scheduling failure leaves saved calendar data intact. Android Keystore protects the background credentials, which the bridge keeps private. If the session expires or is revoked, sign in again to resume network sync.

<a name="build-and-verify"></a>

## Verify offline sync

Install a [preview APK](../apps/README.md#install-and-enable) or [build the Android app](../apps/README.md#android). Use a test account with end-to-end encryption turned off.

1. Sign in online. Disconnect, edit and complete items, then close and reopen the app. Confirm your changes are still there.
2. Reconnect, sync, and compare the records with the website. Then edit the same item on two devices and confirm you can resolve the conflict.
3. Repeat with medication intake marks. Check that deleted items and medications already marked as taken stop generating reminders. Verify background delivery on a physical phone.
