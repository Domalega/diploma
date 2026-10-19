import { request } from "../../../shared/api/http";
import { getToken } from "../../../shared/api/tokenStorage";
const call = (path, options = {}) => request("/kanban" + path, { token: getToken(), ...options });
export const getBoard = (signal) => call("", { signal });
export const changeBoard = (command) => call("", { method: "POST", body: command });
export const getHistory = (id, signal, before) =>
  call(
    "/tasks/" +
      encodeURIComponent(id) +
      "/history?limit=50" +
      (before ? "&before=" + encodeURIComponent(before) : ""),
    { signal },
  );
