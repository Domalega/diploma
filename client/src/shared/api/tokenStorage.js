import { isNativeApp, nativeRequest, setDeviceReminders } from "../reminders/nativeBridge";
import { isOfflineApp, offlineNative } from "../offline/bridge";
import { clearBrowserCache, tokenOwner } from "./browserCache";
const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => {
  if (tokenOwner(getToken()) !== tokenOwner(token)) clearBrowserCache();
  localStorage.setItem(TOKEN_KEY, token);
};
export const clearToken = () => {
  clearBrowserCache();
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
