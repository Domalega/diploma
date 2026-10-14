// Deploy as a web app: execute as yourself, access Anyone.
// Set MAIL_SECRET in Project Settings > Script properties. Never put it in source.
function authorizeMail() {
  return MailApp.getRemainingDailyQuota();
}

function doPost(event) {
  const output = (ok) =>
    ContentService.createTextOutput(JSON.stringify({ ok })).setMimeType(
      ContentService.MimeType.JSON,
    );
  const lock = LockService.getScriptLock();
  try {
    if (
      !event ||
      !event.postData ||
      !event.postData.contents ||
      event.postData.contents.length > 12000
    )
      return output(false);
    const { payload, signature } = JSON.parse(event.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty("MAIL_SECRET");
    if (
      !secret ||
      !/^[a-f0-9]{64}$/.test(secret) ||
      typeof payload !== "string" ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      return output(false);
    const expected = Utilities.computeHmacSha256Signature(payload, secret)
      .map((byte) => ((byte + 256) % 256).toString(16).padStart(2, "0"))
      .join("");
    let difference = 0;
    for (let i = 0; i < expected.length; i++)
      difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    if (difference !== 0) return output(false);
    const message = JSON.parse(payload);
    if (
      !Number.isFinite(message.timestamp) ||
      Math.abs(Date.now() - message.timestamp) > 300000 ||
      !/^[a-f0-9-]{36}$/.test(message.nonce) ||
      typeof message.to !== "string" ||
      !/^[^\s,@<>]+@[^\s,@<>]+\.[^\s,@<>]+$/.test(message.to)
    )
      return output(false);
    if (
      ![
        "Reset your Online Calendar password",
        "Your Online Calendar password has changed",
      ].includes(message.subject) ||
      typeof message.text !== "string" ||
      message.text.length > 4096
    )
      return output(false);
    if (!lock.tryLock(5000)) return output(false);
    const cache = CacheService.getScriptCache();
    if (cache.get(message.nonce) || MailApp.getRemainingDailyQuota() < 1) return output(false);
    MailApp.sendEmail({
      to: message.to,
      subject: message.subject,
      body: message.text,
      name: "Online Calendar",
    });
    cache.put(message.nonce, "sent", 600);
    return output(true);
  } catch {
    return output(false);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
