const { VaultDevice } = require("../models");
const { isUUID } = require("./validation");
const { equal } = require("./syncMerge");
const userWrite = require("./userWrite");
const ApiError = require("../errors/ApiError");
const bad = () => {
  throw ApiError.badRequest("Invalid device connection");
};
function publicKey(key) {
  if (
    !key ||
    Object.keys(key).sort().join(",") !== "crv,kty,x,y" ||
    key.kty !== "EC" ||
    key.crv !== "P-256" ||
    ![key.x, key.y].every(
      (v) =>
        typeof v === "string" &&
        /^[A-Za-z0-9_-]{43}$/.test(v) &&
        Buffer.from(v, "base64url").length === 32,
    )
  )
    bad();
}
function wrappedKey(packet) {
  const b64 = (v, size) =>
    typeof v === "string" &&
    Buffer.from(v, "base64").length === size &&
    Buffer.from(v, "base64").toString("base64") === v;
  if (
    !packet ||
    Object.keys(packet).sort().join(",") !== "ciphertext,iv,publicKey,salt,version" ||
    packet.version !== 1 ||
    !b64(packet.salt, 16) ||
    !b64(packet.iv, 12) ||
    !b64(packet.ciphertext, 48)
  )
    bad();
  publicKey(packet.publicKey);
}
const visible = (row) => ({
  id: row.id,
  publicKey: row.publicKey,
  label: row.label,
  wrappedKey: row.wrappedKey,
  expiresAt: row.expiresAt,
});
const register = (userId, body) =>
  userWrite(
    userId,
    async (transaction) => {
      if (!isUUID(body?.id) || !["Browser", "Android", "Windows"].includes(body.label)) bad();
      publicKey(body.publicKey);
      let row = await VaultDevice.findByPk(body.id, { transaction });
      if (row) {
        if (row.userId !== userId || !equal(row.publicKey, body.publicKey))
          throw ApiError.conflict("The device key changed. Create a new connection.");
        if (!row.wrappedKey)
          await row.update({ expiresAt: new Date(Date.now() + 30 * 60 * 1000) }, { transaction });
      } else {
        if ((await VaultDevice.count({ where: { userId }, transaction })) >= 100)
          throw ApiError.badRequest("Too many connected devices");
        row = await VaultDevice.create(
          {
            id: body.id,
            userId,
            publicKey: body.publicKey,
            label: body.label,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
          { transaction },
        );
      }
      return visible(row);
    },
    { encrypted: true },
  );
const read = (userId, id) =>
  userWrite(
    userId,
    async (transaction) => {
      if (!isUUID(id)) bad();
      const row = await VaultDevice.findOne({ where: { id, userId }, transaction });
      if (!row) throw ApiError.notFound("Device connection was not found");
      return visible(row);
    },
    { encrypted: true },
  );
async function approveInTransaction(userId, body, transaction) {
  if (!isUUID(body?.id)) bad();
  publicKey(body.publicKey);
  wrappedKey(body.wrappedKey);
  const row = await VaultDevice.findOne({ where: { id: body.id, userId }, transaction });
  if (!row || !equal(row.publicKey, body.publicKey))
    throw ApiError.conflict("The connection link does not match this device.");
  if (row.wrappedKey) {
    if (!equal(row.wrappedKey, body.wrappedKey))
      throw ApiError.conflict("This device is already connected");
    return visible(row);
  }
  if (row.expiresAt < new Date())
    throw ApiError.conflict("The connection link expired. Request a new one.");
  await row.update({ wrappedKey: body.wrappedKey }, { transaction });
  return visible(row);
}
const approve = (userId, body) =>
  userWrite(
    userId,
    async (transaction) => {
      if (!(await require("./activeVault")(userId, transaction)))
        throw ApiError.conflict(
          "Enable encryption on your first device before connecting another.",
        );
      return approveInTransaction(userId, body, transaction);
    },
    { encrypted: true },
  );
module.exports = { register, read, approve, approveInTransaction };
