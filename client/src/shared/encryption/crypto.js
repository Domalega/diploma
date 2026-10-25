export const KDF = "PBKDF2-SHA256-600000";
const utf8 = (value) => new TextEncoder().encode(value);
export function base64(bytes) {
  let text = "";
  for (const value of new Uint8Array(bytes)) text += String.fromCharCode(value);
  return btoa(text);
}
const bytes = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export const newSalt = () => base64(window.crypto.getRandomValues(new Uint8Array(16)));
export async function deriveKey(passphrase, salt) {
  if (!window.crypto?.subtle) throw new Error("Encryption requires HTTPS and an updated browser.");
  if (bytes(salt).length !== 16) throw new Error("Invalid encrypted document");
  const material = await window.crypto.subtle.importKey("raw", utf8(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes(salt), iterations: 600000 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(key, salt, value, context) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8(context), tagLength: 128 },
    key,
    utf8(JSON.stringify(value)),
  );
  return { version: 1, kdf: KDF, salt, iv: base64(iv), ciphertext: base64(ciphertext) };
}
export async function open(key, envelope, context) {
  if (envelope?.version !== 1 || envelope.kdf !== KDF || bytes(envelope.iv).length !== 12)
    throw new Error("Invalid encrypted document");
  try {
    const clear = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(envelope.iv), additionalData: utf8(context), tagLength: 128 },
      key,
      bytes(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(clear));
  } catch {
    throw new Error("Incorrect encryption passphrase or damaged data.");
  }
}
