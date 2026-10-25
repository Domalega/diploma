# Optional end-to-end encryption

The calendar opens normally with encryption off. Enable **Settings → End-to-end encryption → Enable encryption** to protect the account. The application creates the key automatically; no new phrase or password is required. Encryption buttons use the shared Bootstrap button components and application styles.

Enabling is account-wide. Existing unencrypted server records are retained as requested, so historical copies are not protected by the new encryption. No cleanup or deletion migration is included.

## Automatic device keys

The first device creates a random 256-bit content key and an ECDH P-256 device key pair. The content key is wrapped for that device with an ephemeral ECDH key, HKDF-SHA-256 and AES-256-GCM. The server receives public keys and wrapped content keys; it never receives the device private key or unwrapped content key. Data envelopes use AES-GCM with fresh 12-byte nonces and 128-bit authentication tags. Authenticated context binds data to the API address, account and local/remote purpose; key-transfer context additionally binds the recipient device and public key. Algorithms use the standard [Web Crypto API](https://www.w3.org/TR/webcrypto-1/).

The browser stores a non-extractable device private key in IndexedDB. It is not stored as plaintext JSON or sent to the API. This does not guarantee hardware-backed or disk-encrypted browser key storage: protection of the whole browser profile depends on the browser and operating system. Android protects the device private key through Android Keystore; the updated Windows app uses user-scoped DPAPI with separate purpose entropy. Both native clients store only the protected private-key representation in IndexedDB and import the opened key as non-extractable during use.

The wrapped content key is retained locally for offline access. Signing out drops the current in-memory content key and cancels reminders but keeps this device's access for the next sign-in. A connected device opens its encrypted data automatically; a separate phrase-based lock is not shown. JavaScript memory cannot be guaranteed to be zeroized, although temporary raw content-key buffers are cleared after use.

## Connect another device

1. Update Daymark on both devices and sign in to the same account.
2. The new device creates its own key pair and displays **Copy connection link**. Copy or share that link to an already connected device.
3. Open the link on the connected device. Confirm that it came from your own new device and press **Approve device**.
4. The new device receives its wrapped key and opens the calendar automatically. **Retry** checks immediately; otherwise the open page checks periodically.

If a link opens in a different browser instead of the already connected native app, use **Settings → End-to-end encryption → Connect another device** in that app and paste the generated connection link. This transfers public connection information, not an encryption phrase. The next screen still requires explicit approval before any key is shared.

The connection link contains only public connection information, not a content key, password or account token. Its full public key is pinned and compared with the server request before approval, preventing the server from silently substituting another recipient key. Approval is never automatic. Pending requests expire after 30 minutes without renewal. Wrapped keys cannot be replaced through the approval endpoint after approval.

Keep at least one connected device. If every device key is lost through device loss, uninstall or cleared browser storage, the server cannot restore encrypted content merely by resetting the account password. Historical plaintext server records remain separate and may be outdated. This version does not provide key recovery or revocation/rotation for a lost device.

Accounts that enabled the earlier phrase-based format retain their existing data. A connected device can authorize another device using the same flow. If no device has remembered the key yet, **Access from the previous version** accepts the old phrase once, verifies it and saves device access. This compatibility path does not ask for a new phrase or rewrite the encrypted document.

## Disable encryption

On a connected device, choose **Settings → End-to-end encryption → Disable encryption** and confirm. An internet connection is required. The client synchronizes and resolves conflicts before submitting the current decrypted document. The server checks the encrypted revision and restores ordinary records in one transaction. Failed validation or a stale revision leaves encryption enabled.

The last encrypted document and the previous ordinary snapshot remain in an account-scoped deactivation archive. Local ciphertext and the corresponding device keys are retained as backups; existing activity is preserved and missing events are added without replacing the history. Other connected clients merge pending changes into the ordinary snapshot or ask to resolve conflicts. Enabling again creates a fresh content key and device registration. Unsynchronized changes from an earlier encryption period are retained and reported instead of silently discarded.

Android 0.4.2 or newer restores its native ordinary snapshot and background synchronization after disabling. Older Android apps must be updated first. Native disk storage still uses operating-system protection; disabling concerns end-to-end encryption and ordinary server storage.

## Storage and synchronization

Notes, dates, times, to-dos, Kanban columns/tasks/activity, medication schedules and intake history are inside the encrypted document. Email, authentication/reset state, public device keys, device type, record sizes and request timing remain visible to the server. Account tokens and appearance preferences are outside content encryption.

Current data and the last server baseline are stored as account/API-scoped ciphertext in local storage. The device key is saved durably before the initial encrypted upload. Existing plaintext server records remain intact throughout bootstrap. The old browser response cache is cleared only after encrypted local storage succeeds. Storage failures reject edits; network failures retain locally saved encrypted changes for retry. Web Locks serialize local writes across tabs.

The `/api/vault` API and legacy calendar writes share an account lock. Revision checks reject stale uploads. Clients merge independent edits after decryption and require a local/server choice for conflicts, including incompatible schedule or WIP changes. Old calendar endpoints reject accounts using an encrypted vault; ordinary accounts continue to use those endpoints normally.

Encrypted synchronization runs while the interface is open, on edits, focus, reconnection, periodically and through **Sync now** in Settings. Android's earlier plaintext background exchange remains disabled for encrypted accounts. Native reminder snapshots are protected by Keystore/DPAPI and can run after the interface closes, but remote changes refresh reminders only after the next open exchange. Notification text can be visible in operating-system notification surfaces.

## Deployment and verification

Deploy the additive `vaultDevices` table and device endpoints before the new clients. Android 0.4.1 and the updated Windows package add native private-key protection; update older native clients before enabling the option. HTTPS, Web Crypto, IndexedDB and Web Locks are required. Keep the configured API address stable because it is part of the encryption context.

The cleartext document limit remains 1.8 million JavaScript characters, including activity; browser storage has its own quota. No truncation or silent eviction is performed. Old SQLite pages, exported files and historical backups are not securely erased by this change. A compromised client, XSS, malicious frontend update or an attacker controlling an unlocked browser profile can access device keys and plaintext. A newly connected device cannot independently detect a malicious rollback of its first downloaded document.

Tests cover optional access, automatic keys surviving reload/sign-out, offline access, explicit device approval, recipient-key substitution, pending/expired requests, immutable wrapped keys, lost upload replies, legacy access, conflict handling and account isolation. Native tests cover Keystore/DPAPI protection and retained storage. Verify browser pairing with separate profiles/devices and test native installation updates before release.
