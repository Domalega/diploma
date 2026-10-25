import { createContext, useContext } from "react";
export const EncryptionContext = createContext({
  mode: "plain",
  enable: async () => {},
  retry: () => {},
});
export const useEncryption = () => useContext(EncryptionContext);
