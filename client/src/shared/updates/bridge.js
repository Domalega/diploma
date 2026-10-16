let sequence = 0;
const pending = new Map();
let bridge;
export const supportsAppUpdates = () => !!window.DaymarkUpdates?.postMessage;
export function updateNative(action) {
  if (!supportsAppUpdates()) return Promise.reject(new Error("Open the updated Android app."));
  if (bridge !== window.DaymarkUpdates) {
    bridge = window.DaymarkUpdates;
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
      if (reply.error) call.reject(new Error(reply.error));
      else call.resolve(reply.result);
    };
  }
  const id = String(++sequence);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("The update service did not respond. Try again."));
    }, 90000);
    pending.set(id, { resolve, reject, timer });
    try {
      bridge.postMessage(JSON.stringify({ id, action }));
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    }
  });
}
