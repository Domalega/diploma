import { request } from "../../../shared/api/http";
import { getToken } from "../../../shared/api/tokenStorage";

export const getList = (signal) => request("/todos", { token: getToken(), signal });
export const changeList = (command) =>
  request("/todos", { token: getToken(), method: "POST", body: command });
