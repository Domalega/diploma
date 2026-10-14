# Google mail delivery

A small Google Apps Script web app sends password recovery emails from its owner's Google account. It requests permission to send mail only. Requests are signed by the API; the shared secret never belongs in the frontend or Git.

1. Create a project at [Google Apps Script](https://script.google.com/home).
2. Paste `Code.js` into the editor. Enable the manifest in Project Settings and replace `appsscript.json` with the supplied file.
3. In Project Settings → Script properties, add `MAIL_SECRET`: a random 32-byte hexadecimal secret. Set the same value as `GOOGLE_MAIL_SECRET` on Render.
4. Run `authorizeMail` once and authorize mail sending from your Google account.
5. Deploy → New deployment → Web app. Set **Execute as: Me**, **Who has access: Anyone**. Copy the `/exec` URL into Render's `GOOGLE_MAIL_URL`.
6. On Render set `MAIL_TRANSPORT=google` and `PASSWORD_RESET_URL=https://domalega.github.io/diploma/#/reset-password`, then redeploy.

The public endpoint rejects unsigned, expired, and repeated requests. Google enforces [daily sending quotas](https://developers.google.com/apps-script/guides/services/quotas): currently 100 recipients for personal accounts and 1,500 for Workspace accounts. Each recovery uses one email for the link and one for the password change notification.

For local development, `MAIL_TRANSPORT=outbox` writes messages into the ignored `server/data/mail/` directory. Outbox delivery is prohibited in production.
