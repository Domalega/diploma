import { webcrypto } from "crypto";
import { TextEncoder, TextDecoder } from "util";
import { deriveKey, newSalt, open, seal } from "./crypto";
beforeAll(() => {
  Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
});
test("AES-GCM round trips Unicode, uses fresh nonces and keeps keys non-extractable", async () => {
  const salt = newSalt(),
    key = await deriveKey("long separate encryption phrase", salt);
  const value = { note: "Личные заметки 🔒", medications: ["Private"] };
  const a = await seal(key, salt, value, "account-1:remote"),
    b = await seal(key, salt, value, "account-1:remote");
  expect(a.iv).not.toEqual(b.iv);
  expect(a.ciphertext).not.toEqual(b.ciphertext);
  expect(await open(key, a, "account-1:remote")).toEqual(value);
  expect(key.extractable).toBe(false);
  await expect(webcrypto.subtle.exportKey("raw", key)).rejects.toThrow();
  expect(JSON.stringify(a)).not.toContain("Private");
});
test("wrong phrases, altered ciphertext, another account and local/remote swaps fail closed", async () => {
  const salt = newSalt(),
    key = await deriveKey("correct separate encryption phrase", salt);
  const encoded = await seal(key, salt, { private: true }, "account-1:remote");
  const wrong = await deriveKey("a different encryption phrase", salt);
  await expect(open(wrong, encoded, "account-1:remote")).rejects.toThrow(/Incorrect/);
  await expect(open(key, encoded, "account-2:remote")).rejects.toThrow(/Incorrect/);
  await expect(open(key, encoded, "account-1:local")).rejects.toThrow(/Incorrect/);
  const raw = atob(encoded.ciphertext);
  const tampered = btoa(String.fromCharCode(raw.charCodeAt(0) ^ 1) + raw.slice(1));
  await expect(open(key, { ...encoded, ciphertext: tampered }, "account-1:remote")).rejects.toThrow(
    /Incorrect/,
  );
  await expect(open(key, { ...encoded, version: 2 }, "account-1:remote")).rejects.toThrow(
    /Invalid/,
  );
});
