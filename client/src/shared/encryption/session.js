let session = null;
let epoch = 0;
export const encryptionEpoch = () => epoch;
export const encryptionSession = () => session;
export const setEncryptionSession = (value) => {
  session = value;
};
export function lockEncryption() {
  epoch++;
  session = null;
  window.dispatchEvent(new Event("daymark:lock"));
}
