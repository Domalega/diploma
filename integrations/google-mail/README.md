# Password recovery emails with Google Apps Script

English · [Русский](../../docs/ru/GOOGLE_MAIL.md)

Use this setup to send password recovery emails from a Google account when Jotstride is hosted on Render. The Apps Script web app requests permission to send mail. Render signs each request with a shared secret, so keep that secret in Render and Apps Script only.

## Set up the web app

1. Create a project in [Google Apps Script](https://script.google.com/home). Replace the default script with the contents of [`Code.js`](Code.js).
2. In **Project Settings**, show the manifest file in the editor. Replace its contents with [`appsscript.json`](appsscript.json).
3. Under **Project Settings → Script properties**, create `MAIL_SECRET`. Use a random 32-byte secret encoded as 64 lowercase hexadecimal characters.
4. Select and run `authorizeMail` once. Approve the permission to send mail from the Google account that owns the script.
5. Choose **Deploy → New deployment**. Next to **Select type**, open the deployment types menu and choose **Web app**.
6. Set **Execute as** to **Me** and **Who has access** to **Anyone**. Select **Deploy** and copy the deployment URL ending in `/exec`.

## Configure Render

Set these environment variables on the API service and redeploy.

| Variable             | Value                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `MAIL_TRANSPORT`     | `google`                                                                                    |
| `GOOGLE_MAIL_URL`    | The Apps Script deployment URL ending in `/exec`                                            |
| `GOOGLE_MAIL_SECRET` | The same value as `MAIL_SECRET`                                                             |
| `PASSWORD_RESET_URL` | `https://domalega.github.io/diploma/#/reset-password` for this repository's hosted frontend |

Request a password reset for a test account. Confirm that the link opens the password reset screen and that changing the password triggers a second email.

The endpoint checks the request signature and timestamp. It rejects a repeat while the request's unique identifier is still in the [Apps Script cache](https://developers.google.com/apps-script/reference/cache/cache-service). Each completed reset uses two messages, and the sending account's [daily Google quota](https://developers.google.com/apps-script/guides/services/quotas) applies.

For local development, `MAIL_TRANSPORT=outbox` saves messages in `server/data/mail/`, which Git ignores. Use Google delivery in production.
