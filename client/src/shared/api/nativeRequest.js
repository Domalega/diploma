export default function createNativeRequest(getBridge, { timeout, unavailable, timeoutMessage }) {
  const pending = new Map();
  let sequence = 0;
  let listeningBridge;

  function receive({ data }) {
    let reply;
    try {
      reply = typeof data === "string" ? JSON.parse(data) : data;
    } catch {
      return;
    }
    const call = pending.get(reply?.id);
    if (!call) return;
    pending.delete(reply.id);
    clearTimeout(call.timer);
    if (reply.error) {
      const error = new Error(reply.error);
      if (reply.status !== undefined) error.status = reply.status;
      call.reject(error);
    } else call.resolve(reply.result);
  }

  return function request(action, payload = {}) {
    const bridge = getBridge();
    if (!bridge) return Promise.reject(new Error(unavailable));
    if (bridge !== listeningBridge) {
      if (bridge.addEventListener) bridge.addEventListener("message", receive);
      else bridge.onmessage = receive;
      listeningBridge = bridge;
    }
    const id = String(++sequence);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(timeoutMessage));
      }, timeout);
      pending.set(id, { resolve, reject, timer });
      try {
        bridge.postMessage(JSON.stringify({ id, action, payload }));
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  };
}
