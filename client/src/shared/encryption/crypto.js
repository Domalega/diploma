export const KDF = "PBKDF2-SHA256-600000";
const utf8 = (value) => new TextEncoder().encode(value);
export function base64(bytes) {
  let text = "";
  for (const value of new Uint8Array(bytes)) text += String.fromCharCode(value);
  return btoa(text);
}
export const bytes = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
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
export async function seal(key, salt, value, context, version = 1) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8(context), tagLength: 128 },
    key,
    utf8(JSON.stringify(value)),
  );
  return {
    version,
    kdf: version === 2 ? "DEVICE-KEY" : KDF,
    salt,
    iv: base64(iv),
    ciphertext: base64(ciphertext),
  };
}
export async function open(key, envelope, context) {
  if (
    !(
      (envelope?.version === 1 && envelope.kdf === KDF) ||
      (envelope?.version === 2 && envelope.kdf === "DEVICE-KEY")
    ) ||
    bytes(envelope.iv).length !== 12
  )
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

export const cleanPublicKey = ({ kty, crv, x, y }) => ({ kty, crv, x, y });
export const samePublicKey = (a, b) => ["kty", "crv", "x", "y"].every((k) => a?.[k] === b?.[k]);
const publicCryptoKey = (key) =>
  window.crypto.subtle.importKey(
    "jwk",
    cleanPublicKey(key),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
export const contentKey = (raw) =>
  window.crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
async function transferKey(privateKey, publicKey, salt, context) {
  const secret = await window.crypto.subtle.deriveBits(
    { name: "ECDH", public: await publicCryptoKey(publicKey) },
    privateKey,
    256,
  );
  const material = await window.crypto.subtle.importKey("raw", secret, "HKDF", false, [
    "deriveKey",
  ]);
  new Uint8Array(secret).fill(0);
  return window.crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: bytes(salt), info: utf8(context) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function wrapContentKey(raw, recipient, context) {
  const ephemeral = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const salt = newSalt(),
    iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await transferKey(ephemeral.privateKey, recipient, salt, context);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8(context), tagLength: 128 },
    key,
    raw,
  );
  return {
    version: 1,
    publicKey: cleanPublicKey(await window.crypto.subtle.exportKey("jwk", ephemeral.publicKey)),
    salt,
    iv: base64(iv),
    ciphertext: base64(ciphertext),
  };
}
export async function unwrapContentKey(packet, privateKey, context) {
  if (
    packet?.version !== 1 ||
    bytes(packet.salt).length !== 16 ||
    bytes(packet.iv).length !== 12 ||
    bytes(packet.ciphertext).length !== 48
  )
    throw new Error("Invalid device connection");
  const key = await transferKey(privateKey, packet.publicKey, packet.salt, context);
  const raw = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(packet.iv), additionalData: utf8(context), tagLength: 128 },
    key,
    bytes(packet.ciphertext),
  );
  if (raw.byteLength !== 32) throw new Error("Invalid device connection");
  return new Uint8Array(raw);
}
export async function legacyRawKey(passphrase, salt) {
  const material = await window.crypto.subtle.importKey("raw", utf8(passphrase), "PBKDF2", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await window.crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: bytes(salt), iterations: 600000 },
      material,
      256,
    ),
  );
}
