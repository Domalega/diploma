import { request } from "../../../shared/api/http";
import { getToken } from "../../../shared/api/tokenStorage";

export const getAllDates = (signal) => request("/userDate/get", { token: getToken(), signal });
export const createDate = (date, comment, time = null) =>
  request("/userDate/create", {
    method: "POST",
    token: getToken(),
    body: { date, comment, time },
  });
export const deleteDate = (id) =>
  request("/userDate/delete", {
    method: "DELETE",
    token: getToken(),
    body: { id },
  });
export const updateDate = (id, changes) =>
  request("/userDate/update", {
    method: "PATCH",
    token: getToken(),
    body: { id, ...changes },
  });
