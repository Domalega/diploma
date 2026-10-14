import { request } from "../../../shared/api/http";

export const login = (email, password) =>
  request("/user/login", {
    method: "POST",
    body: { email, password },
  });
export const register = (email, password) =>
  request("/user/registration", {
    method: "POST",
    body: { email, password },
  });
export const check = (token, signal) => request("/user/auth", { token, signal });
export const recoveryStatus = () => request("/user/password-recovery");
export const forgotPassword = (email) =>
  request("/user/forgot-password", { method: "POST", body: { email } });
export const resetPassword = (token, password) =>
  request("/user/reset-password", { method: "POST", body: { token, password } });
