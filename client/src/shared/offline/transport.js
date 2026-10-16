import { offlineNative } from "./bridge";
import { localApi } from "./localApi";
let tail = Promise.resolve();
export function offlineRequest(path, { token, method = "GET", body, signal }) {
  const run = async () => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (path.startsWith("/user/")) return offlineNative("request", { path, method, body, token });
    const document = await offlineNative("read", { token });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { result, state } = localApi(document, path, method, body);
    if (state) await offlineNative("write", { token, state, generation: document.generation });
    return result;
  };
  const result = tail.then(run);
  tail = result.catch(() => {});
  return result;
}
