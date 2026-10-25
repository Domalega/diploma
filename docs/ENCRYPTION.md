# Encrypted storage preparation

This implementation is staged. Enabling encryption creates an encrypted account document and makes it authoritative for subsequent client operations. **Existing server tables are preserved, including their old plaintext contents.** Accounts with retained records show a persistent notice. No cleanup endpoint or automatic deletion migration is included. Historical database files, snapshots and backups are not rewritten.

## Keys and contents

After account sign-in, the calendar requires a separate encryption passphrase. A new phrase must contain at least 12 characters and be entered twice; choose a long, unique phrase and keep it in a password manager. The phrase is never included in API requests. Losing it makes encrypted content inaccessible, even after account password recovery. The same phrase unlocks the account on another device.

Web Crypto derives a non-extractable 256-bit AES key with PBKDF2-HMAC-SHA-256, 600,000 iterations and a random 16-byte account salt. AES-GCM uses a fresh random 12-byte nonce and a 128-bit authentication tag for every write. Authenticated context binds the ciphertext to the account, configured API address and local/server purpose. Local and remote envelopes cannot be exchanged. These primitives are specified by [Web Crypto](https://www.w3.org/TR/webcrypto-1/); the PBKDF2 work factor follows the [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2).

Notes, dates, times, to-dos, Kanban columns/tasks/activity, medication schedules and intake history are inside the encrypted document. The API stores only the envelope, revision, ownership and retained-legacy flag. Email addresses, password hashes, authentication/reset state, record sizes and request timing remain visible to the server. Browser account tokens and appearance preferences are outside the content encryption boundary.

The content key exists only in the running client's memory. Reloading or locking the page requires the phrase again. Signing out drops the key and cancels device reminders; pending encrypted local data remains for the next sign-in to the same account. JavaScript garbage collection does not provide guaranteed memory zeroization.

## Local storage and synchronization

The browser and bundled Android interface persist the current document and its last server baseline as authenticated ciphertext in account/API-scoped local storage. Web Locks serialize local commits across tabs; a tab with an obsolete copy must lock and unlock again. Browsers without Web Locks reject encrypted writes instead of using an unsafe fallback. The old web response cache is cleared only after a durable encrypted copy has been saved and unlocked. Storage quota failures reject the edit; network failures retain a successfully encrypted local edit and show a pending status.

The `/api/vault` API serializes writes with the same account lock as the legacy APIs and requires the last known revision. Clients decrypt and merge independent changes; conflicting edits/deletions and incompatible combined constraints require an explicit local/server choice. A server response older than the locally recorded revision is rejected. A device without prior state cannot independently detect a malicious rollback of its first downloaded document.

Encrypted accounts reject legacy calendar, to-do, Kanban, medication and `/sync` reads and writes. The transaction guard also rejects writes that passed an earlier HTTP check. Account authentication and password recovery remain available. A bootstrap digest rejects a migration snapshot if a legacy client edited data in the meantime. The client verifies a decryption round trip and saves encrypted local recovery state before uploading its first envelope. Server plaintext records are retained as requested.

Android converts existing SQLite account documents to Keystore-encrypted values on database open without dropping records. New legacy-backup imports and reminder plans are encrypted as well. The application has Android backup disabled. Windows already protects native reminder snapshots with user-scoped DPAPI; its embedded website uses the same encrypted content store as the browser.

For encrypted accounts, synchronization runs while the interface is open and unlocked, on changes, reconnection, focus, periodically and through **Sync now**. Android's previous plaintext background exchange is disabled. Pending edits from an older Android document are merged before switching to the encrypted client. Already saved native reminders can fire with the interface closed, but remote changes do not refresh those reminders until the next unlocked synchronization. The reminder plan is protected by the device Keystore/DPAPI, so the operating system can read it without the content passphrase. Notification text can be visible through operating-system notification surfaces.

## Deployment and limits

- Deploy the additive server schema and `/api/vault` endpoint before publishing the new website or Android bundle. No production deployment or account migration is performed by changing this source tree.
- Older clients cannot edit an account after its encrypted document has been created. Update each device before enabling encryption.
- Keep the configured API address stable: it is part of the authenticated encryption context. Changing it requires an explicit ciphertext migration.
- The current cleartext document limit is 1.8 million JavaScript characters, including activity history. Browser storage has its own quota; large documents can fail to save. No truncation or silent eviction is performed.
- This change does not securely erase old SQLite pages, preference backups, server backups or previously exported files. Their cleanup is separate work and needs explicit approval.
- HTTPS and an up-to-date WebView/browser are required. A compromised client, XSS, a malicious frontend update or an already unlocked device can access plaintext. This is not a security audit or a defense against a server that can replace the client application.

## Verification

Run server and client tests, ESLint, Prettier and the production web build. Encryption tests cover wrong phrases, tampering, account/purpose binding, fresh nonces, encrypted local persistence, offline reload/logout, quota failures, concurrent devices, conflict resolution, stale revisions and legacy endpoint rejection. Server tests verify retained original rows and atomic revision checks. Android instrumentation includes raw SQLite ciphertext and lossless legacy-document conversion checks; these require an emulator/device with Android Keystore.

Before release, validate Android installation/update, offline editing after a process restart, pending edits from an older client, conflict choices, Keystore persistence after reboot, and reminder delivery on a real device. A Java source compilation does not establish those runtime properties.
