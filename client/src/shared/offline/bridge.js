let sequence = 0;
const pending = new Map();
let bridge;
export const isOfflineApp = () => !!window.DaymarkOffline?.postMessage;
export function offlineNative(action, payload = {}) {
  if (!isOfflineApp()) return Promise.reject(new Error("Open the updated Android app."));
  if (bridge !== window.DaymarkOffline) {
    bridge = window.DaymarkOffline;
    bridge.onmessage = ({ data }) => {
      let reply;
      try {
        reply = JSON.parse(data);
      } catch {
        return;
      }
      const call = pending.get(reply.id);
      if (!call) return;
      pending.delete(reply.id);
      clearTimeout(call.timer);
      if (reply.error) {
        const error = new Error(reply.error);
        error.status = reply.status;
        call.reject(error);
      } else call.resolve(reply.result);
    };
  }
  const id = String(++sequence);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Local storage did not respond. Try again."));
    }, 90000);
    pending.set(id, { resolve, reject, timer });
    bridge.postMessage(JSON.stringify({ id, action, payload }));
  });
}
