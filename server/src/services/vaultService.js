const { createHash } = require("node:crypto");
const models = require("../models");
const { EncryptedVault } = models;
const userWrite = require("./userWrite");
const { snapshot } = require("./syncService");
const { canonical } = require("./syncMerge");
const ApiError = require("../errors/ApiError");

const digest = (value) => createHash("sha256").update(canonical(value)).digest("hex");
function validate(envelope) {
  const base64 = (v, min, max) =>
    typeof v === "string" &&
    v.length >= min &&
    v.length <= max &&
    v.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(v) &&
    Buffer.from(v, "base64").toString("base64") === v;
  if (
    !envelope ||
    Object.keys(envelope).sort().join(",") !== "ciphertext,iv,kdf,salt,version" ||
    !(
      (envelope.version === 1 && envelope.kdf === "PBKDF2-SHA256-600000") ||
      (envelope.version === 2 && envelope.kdf === "DEVICE-KEY")
    ) ||
    !base64(envelope.salt, 24, 24) ||
    Buffer.from(envelope.salt, "base64").length !== 16 ||
    !base64(envelope.iv, 16, 16) ||
    Buffer.from(envelope.iv, "base64").length !== 12 ||
    !base64(envelope.ciphertext, 24, 5_000_000)
  )
    throw ApiError.badRequest("Invalid encrypted document");
}
const read = (userId) =>
  userWrite(
    userId,
    async (transaction) => {
      const vault = await EncryptedVault.findByPk(userId, { transaction });
      if (vault)
        return {
          encrypted: true,
          revision: vault.revision,
          legacyRetained: vault.legacyRetained,
          envelope: vault.envelope,
        };
      const legacy = await snapshot(userId, transaction);
      return { encrypted: false, legacy, digest: digest(legacy) };
    },
    { encrypted: true },
  );

const save = (userId, body) =>
  userWrite(
    userId,
    async (transaction) => {
      validate(body?.envelope);
      if (!Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= 2147483647)
        throw ApiError.badRequest("Invalid encrypted revision");
      const vault = await EncryptedVault.findByPk(userId, { transaction });
      if (!vault) {
        const legacy = await snapshot(userId, transaction);
        if (body.revision !== 0 || body.digest !== digest(legacy))
          throw ApiError.conflict("Data changed. Reload before enabling encryption.");
        if (body.envelope.version === 2)
          await require("./vaultDeviceService").approveInTransaction(
            userId,
            body.device,
            transaction,
          );
        // Keep the existing tables intact until a separately approved cleanup.
        const legacyRetained = (
          await Promise.all(
            [
              "UserDate",
              "TodoList",
              "KanbanBoard",
              "KanbanTask",
              "KanbanEvent",
              "MedicationPlan",
              "MedicationIntake",
            ].map((name) => models[name].count({ where: { userId }, transaction })),
          )
        ).some((count) => count > 0);
        await EncryptedVault.create(
          { userId, revision: 1, envelope: body.envelope, legacyRetained: !!legacyRetained },
          { transaction },
        );
        return { revision: 1, legacyRetained: !!legacyRetained };
      }
      if (body.revision !== vault.revision)
        throw ApiError.conflict("Encrypted data changed on another device. Sync and try again.");
      if (body.envelope.salt !== vault.envelope.salt)
        throw ApiError.badRequest("The encryption salt cannot be changed");
      if (body.envelope.version !== vault.envelope.version)
        throw ApiError.badRequest("The encryption format cannot be changed");
      await vault.update(
        { revision: vault.revision + 1, envelope: body.envelope },
        { transaction },
      );
      return { revision: vault.revision, legacyRetained: vault.legacyRetained };
    },
    { encrypted: true },
  );
module.exports = { read, save };
