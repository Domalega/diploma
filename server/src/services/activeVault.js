const { EncryptedVault, VaultDeactivation } = require("../models");
module.exports = async function activeVault(userId, transaction) {
  const vault = await EncryptedVault.findByPk(userId, { transaction });
  if (!vault) return null;
  const disabled = await VaultDeactivation.findOne({
    where: { userId, revision: vault.revision, salt: vault.envelope.salt },
    transaction,
  });
  return disabled ? null : vault;
};
