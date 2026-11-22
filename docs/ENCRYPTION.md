# Optional end-to-end encryption

English · [Русский](ru/ENCRYPTION.md)

End-to-end encryption is off by default. It protects your current calendar data, including notes, dates, times, to-dos, Kanban columns, tasks and activity, medication schedules and intake history. Jotstride retains existing unencrypted server records, so historical copies stay outside this protection and may be out of date.

**Keep at least one connected device after enabling encryption.** If you lose all the device keys Jotstride created for your account, resetting your password won't recover encrypted data. This version has no device-key recovery, revocation or rotation.

To enable encryption, connect to the internet and open **Settings → End-to-end encryption → Enable encryption**. Jotstride creates the keys automatically. You can keep using your existing account password.

## Connect another device

1. Connect both devices to the internet. Update Jotstride on both devices and sign in to the same account.
2. On the new device, select **Copy connection link** and send the link to a device that already has access.
3. Open the link on the connected device. Check that it came from your new device, then select **Approve device**.
4. Leave the calendar open on the new device. It checks for approval periodically and opens automatically once it has the wrapped key. Select **Retry** to check immediately.

If the link opens in a different browser, switch to the already connected app. Open **Settings → End-to-end encryption → Connect another device**, paste the link and select **Review connection**. Check that the request came from your new device, then select **Approve device**.

### Access from the previous version

If you used the earlier phrase-based encryption, a device with saved access can approve a new one through the same steps. If no device has remembered the key, open **Access from the previous version** on the new device and enter the old phrase once. Jotstride verifies it and saves access for that device. The encrypted document stays in its existing format.

## Disable encryption

On a connected device with internet access, open **Settings → End-to-end encryption → Disable encryption** and confirm. Jotstride syncs first and asks you to resolve any conflicts. The server checks the encrypted revision and restores ordinary account records in one transaction. If the revision is stale or validation fails, encryption stays on.

The server keeps the last encrypted document and the previous ordinary snapshot in an account-scoped archive. The device retains its encrypted copy and its keys. Jotstride preserves existing activity and adds missing entries. Other connected devices merge pending changes into ordinary storage or ask you to resolve conflicts. If you enable encryption again, Jotstride creates a fresh content key and device registration. It keeps and reports any unsynced changes from an earlier encryption period.

On Android, update to version 0.4.2 or newer before disabling encryption. These versions can restore the native snapshot and resume ordinary background sync. Android Keystore and Windows DPAPI still protect their respective native data after you disable end-to-end encryption.

## Automatic device keys

- **Key creation.** The first device generates a random 256-bit content key and an ECDH P-256 device key pair. Each recipient gets its own wrapped copy of the content key. Wrapping uses ephemeral ECDH, HKDF-SHA-256 and AES-256-GCM. The server receives public keys and wrapped keys. Device private keys and the unwrapped content key stay on the clients.
- **Data protection.** Jotstride uses AES-GCM with a fresh 12-byte nonce and a 128-bit authentication tag for each data envelope. Authenticated context binds it to the API address, account and local or remote purpose. The key-transfer context also binds the recipient device and public key. [Web Crypto API specification](https://www.w3.org/TR/webcrypto-1/)
- **Device approval.** The connection link carries only public connection details. Before wrapping the key, the approving device compares the full public key from the link with the server's pending request. This check rejects recipient-key substitution through the server. Approval requires user confirmation. Pending requests expire after 30 minutes without renewal. The approval endpoint rejects attempts to replace an approved wrapped key.
- **Key storage.** The browser keeps the device private key in IndexedDB as a non-extractable Web Crypto key. The browser and operating system determine how well the profile is protected at rest. Android protects native keys with Keystore and Windows uses user-scoped DPAPI with separate purpose entropy. Native clients store the protected representation in IndexedDB and import the opened key as non-extractable for use.
- **Signing out.** The wrapped content key stays on the device for future access, including offline use. Signing out clears the active content key from application state and cancels reminders. A connected device opens the data automatically on the next sign-in. Jotstride clears temporary raw key buffers after use, while JavaScript does not guarantee complete memory zeroization.

## Storage and synchronization

The server can still see email, authentication and password-reset state, public device keys, device type, record sizes and request timing. Account tokens and appearance preferences are outside the encrypted document.

Jotstride stores the current document and last server baseline as ciphertext scoped to the account and API. It saves the device key before the first encrypted upload and clears the old browser response cache only after the encrypted local write succeeds. Web Locks serialize writes from multiple tabs. If local storage fails, the edit is rejected. If the network fails after the edit is saved locally, Jotstride can retry it later.

Writes to `/api/vault` and ordinary calendar writes share the account lock. Revision checks reject stale uploads. Clients decrypt documents locally, merge independent changes and ask you to choose a version when records conflict, including incompatible schedule or Kanban work-in-progress limit changes. An active vault blocks access to ordinary calendar endpoints for that account. Accounts with encryption off continue to use ordinary sync.

Sync runs while the interface is open, including on edits, focus, reconnection, periodic checks and **Sync now** in Settings. Android's ordinary background exchange is disabled for encrypted accounts. Native reminders can still fire after the app closes. Changes from other devices update those reminders at the next open sync. The operating system may show reminder text in notifications.

## Deployment and verification

Deploy the server with the additive `vaultDevices` table and device endpoints before updating clients. Android 0.4.1 and the updated Windows package add native protection for device private keys. Update older native clients before enabling encryption. Use HTTPS and clients with Web Crypto, IndexedDB and Web Locks. Keep the API address stable because it is part of the encryption context.

The cleartext document, including activity, can contain up to 1.8 million JavaScript string units when serialized. Browser storage has its own quota. The app rejects oversized documents without truncating them or evicting records. Old SQLite pages, exports and historical backups fall outside this feature's protection. A compromised device, malicious frontend update, cross-site scripting or control of an unlocked profile can expose keys and plaintext. A newly connected device cannot independently detect a rollback of the first document it downloads.

The test suite covers device approval, recipient-key checks, expired requests, immutable wrapped keys, offline access, retained access after reload and sign-out, lost upload responses, legacy-format access, conflicts and account isolation. Native tests cover Keystore and DPAPI protection and retained storage. Before release, pair two browser profiles or devices and test upgrading existing native installations.
