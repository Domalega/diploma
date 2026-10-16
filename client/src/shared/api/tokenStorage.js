import { isNativeApp, nativeRequest, setDeviceReminders } from "../reminders/nativeBridge";
import { isOfflineApp, offlineNative } from "../offline/bridge";
const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  if (isOfflineApp()) offlineNative("logout").catch(() => {});
  if (isNativeApp()) {
    try {
      setDeviceReminders(false);
    } catch {
      /* Storage can be unavailable. */
    }
    nativeRequest("clear").catch(() => {});
  }
};
