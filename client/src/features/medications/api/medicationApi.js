import { request } from "../../../shared/api/http";
import { getToken } from "../../../shared/api/tokenStorage";
const call = (path, options = {}) =>
  request("/medications" + path, { token: getToken(), ...options });
export const getPlan = (signal) => call("/plan", { signal });
export const savePlan = (plan) => call("/plan", { method: "PUT", body: plan });
export const getIntakes = (date, signal) =>
  call("/intakes?date=" + encodeURIComponent(date), { signal });
export const markCell = (values) => call("/intakes", { method: "PUT", body: values });
export const markColumn = (values) => call("/intakes/column", { method: "PUT", body: values });
