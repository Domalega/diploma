const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHmac } = require("node:crypto");
const { mail } = require("../config/env");

function isConfigured() {
  return Boolean(
    mail.resetUrl && (mail.transport === "outbox" || (mail.googleUrl && mail.googleSecret)),
  );
}

async function send(to, subject, text) {
  if (!isConfigured()) throw new Error("Email delivery is not configured");
  if (mail.transport === "outbox") {
    await mkdir(mail.outbox, { recursive: true });
    await writeFile(
      path.join(mail.outbox, `${randomUUID()}.json`),
      JSON.stringify({ to, subject, text }),
      { mode: 0o600 },
    );
    return;
  }
  const payload = JSON.stringify({ to, subject, text, timestamp: Date.now(), nonce: randomUUID() });
  const signature = createHmac("sha256", mail.googleSecret).update(payload).digest("hex");
  const response = await fetch(mail.googleUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, signature }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
  if ((await response.json()).ok !== true) throw new Error("Google email delivery failed");
}

function resetLink(token) {
  const url = new URL(mail.resetUrl);
  if (url.hash) url.hash = `${url.hash.slice(1)}?token=${token}`;
  else url.searchParams.set("token", token);
  return url.toString();
}

function sendReset(to, token) {
  return send(
    to,
    "Reset your Online Calendar password",
    `A password reset was requested for your Online Calendar account.\n\n${resetLink(token)}\n\nThis link expires in 15 minutes and can be used once. If you did not request this, you can ignore this email. Your password has not changed.`,
  );
}

function sendResetConfirmation(to) {
  return send(
    to,
    "Your Online Calendar password has changed",
    "Your Online Calendar password was reset. All existing sessions have been signed out. If you did not make this change, request another password reset to regain access to your account.",
  );
}

module.exports = { isConfigured, sendReset, sendResetConfirmation };
