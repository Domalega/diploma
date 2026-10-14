import { request } from "../../../shared/api/http";
import { getToken } from "../../../shared/api/tokenStorage";

export const getAllDates = (signal) => request("/userDate/get", { token: getToken(), signal });
export const createDate = (date, comment) =>
  request("/userDate/create", {
    method: "POST",
    token: getToken(),
    body: { date, comment },
  });
export const deleteDate = (date) =>
  request("/userDate/delete", {
    method: "DELETE",
    token: getToken(),
    body: { date },
  });
export const updateDate = (date, comment) =>
  request("/userDate/update", {
    method: "PATCH",
    token: getToken(),
    body: { date, comment },
  });
