const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { createHmac, randomUUID } = require("node:crypto");
const code = fs.readFileSync(
  path.resolve(__dirname, "../../integrations/google-mail/Code.js"),
  "utf8",
);

test("Google mail bridge accepts signed requests and rejects replay, expiry and tampering", () => {
  const secret = "1".repeat(64);
  const sent = [],
    cache = new Map();
  const context = vm.createContext({
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (message) => sent.push(message) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => secret }) },
    Utilities: {
      computeHmacSha256Signature: (value, key) => [
        ...createHmac("sha256", key).update(value).digest(),
      ],
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, hasLock: () => true, releaseLock: () => {} }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => cache.get(key),
        put: (key, value) => cache.set(key, value),
      }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (value) => ({ setMimeType: () => value }),
    },
  });
  vm.runInContext(code, context);
  function invoke(message, tamper = false) {
    const payload = JSON.stringify(message);
    const signature = tamper
      ? "0".repeat(64)
      : createHmac("sha256", secret).update(payload).digest("hex");
    return JSON.parse(
      context.doPost({ postData: { contents: JSON.stringify({ payload, signature }) } }),
    );
  }
  const message = {
    to: "test@example.com",
    subject: "Reset your Online Calendar password",
    text: "Test recovery",
    timestamp: Date.now(),
    nonce: randomUUID(),
  };
  assert.equal(invoke(message, true).ok, false);
  assert.equal(invoke({ ...message, timestamp: Date.now() - 400_000 }).ok, false);
  assert.equal(invoke({ ...message, to: "test@example.com,other@example.com" }).ok, false);
  assert.equal(invoke(message).ok, true);
  assert.equal(invoke(message).ok, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, message.to);
});
