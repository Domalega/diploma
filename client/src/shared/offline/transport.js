import { offlineNative } from "./bridge";
import { localApi } from "./localApi";
let tail = Promise.resolve();
export function offlineRequest(path, { token, method = "GET", body, signal }) {
  const history = /^\/kanban\/tasks\/([^/]+)\/history(?:\?(.*))?$/.exec(path);
  if (method === "GET" && history)
    return (async () => {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const query = new URLSearchParams(history[2]);
      const result = await offlineNative("history", {
        token,
        taskId: decodeURIComponent(history[1]),
        limit: Number(query.get("limit") || 50),
        before: query.has("before") ? Number(query.get("before")) : null,
      });
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return result;
    })();
  const run = async () => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (path.startsWith("/user/")) return offlineNative("request", { path, method, body, token });
    const document = await offlineNative("read", {
      token,
      path: method === "GET" ? path : "/state",
    });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { result, state } = localApi(document, path, method, body);
    if (state) await offlineNative("write", { token, state, generation: document.generation });
    return result;
  };
  const result = tail.then(run);
  tail = result.catch(() => {});
  return result;
}
