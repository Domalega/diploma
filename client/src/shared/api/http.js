import { clearToken, getToken } from "./tokenStorage";
import { isOfflineApp } from "../offline/bridge";
import { offlineRequest } from "../offline/transport";
import { encryptionSession } from "../encryption/session";
import { encryptedRequest } from "../encryption/vault";

const BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function request(path, { method = "GET", body, token, signal } = {}) {
  if (!path.startsWith("/user/") && encryptionSession())
    return encryptedRequest(path, { method, body, token, signal });
  if (isOfflineApp()) return offlineRequest(path, { method, body, token, signal });
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    if (response.ok) throw new ApiError("Invalid response from the server", response.status);
  }
  if (!response.ok) {
    if (response.status === 401 && token && getToken() === token) clearToken();
    throw new ApiError(data?.message || "Request failed", response.status);
  }
  return data;
}
