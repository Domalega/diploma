import { isOfflineApp } from "../offline/bridge";
import { encryptionSession } from "../encryption/session";

const CACHE_KEY = "daymark.web-data.v1";
const SOURCE = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const MAX_ENTRIES = 40;
const MAX_SIZE = 2 * 1024 * 1024;

// The JWT payload selects a local copy; the server still authorizes every request.
export function tokenOwner(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Number.isSafeInteger(payload.id) && payload.id > 0 ? String(payload.id) : null;
  } catch {
    return null;
  }
}

function document() {
  const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  return saved?.source === SOURCE && saved.entries && typeof saved.entries === "object"
    ? saved
    : null;
}

export function clearBrowserCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Browsing remains available when persistent storage is disabled.
  }
}

export function cacheSession() {
  if (encryptionSession()) return null;
  if (isOfflineApp()) return null;
  try {
    const owner = tokenOwner(localStorage.getItem("token"));
    if (!owner) return null;
    let saved = document();
    if (saved?.owner !== owner) {
      saved = { source: SOURCE, owner, session: `${Date.now()}:${Math.random()}`, entries: {} };
      localStorage.setItem(CACHE_KEY, JSON.stringify(saved));
    }
    return { owner, session: saved.session };
  } catch {
    return null;
  }
}

function currentDocument(session) {
  if (encryptionSession()) return null;
  if (!session || tokenOwner(localStorage.getItem("token")) !== session.owner) return null;
  const saved = document();
  return saved?.owner === session.owner && saved.session === session.session ? saved : null;
}

export function readCachedResource(key, session = cacheSession()) {
  try {
    return currentDocument(session)?.entries[key]?.data;
  } catch {
    return undefined;
  }
}

export function saveCachedResource(key, data, session) {
  if (!key) return;
  try {
    const saved = currentDocument(session);
    if (!saved) return;
    saved.entries[key] = { data, updatedAt: Date.now() };
    const oldest = Object.keys(saved.entries)
      .filter((entry) => entry !== key)
      .sort((a, b) => saved.entries[a].updatedAt - saved.entries[b].updatedAt);
    let encoded = JSON.stringify(saved);
    while (
      (Object.keys(saved.entries).length > MAX_ENTRIES || encoded.length > MAX_SIZE) &&
      oldest.length
    ) {
      delete saved.entries[oldest.shift()];
      encoded = JSON.stringify(saved);
    }
    if (encoded.length <= MAX_SIZE) localStorage.setItem(CACHE_KEY, encoded);
    else clearBrowserCache();
  } catch {
    // Cache failures must never turn a successful server save into an error.
    clearBrowserCache();
  }
}

export const hasCachedCalendar = () => {
  if (readCachedResource("dates") !== undefined) return true;
  try {
    const owner = tokenOwner(localStorage.getItem("token"));
    return !!owner && !!localStorage.getItem(`daymark.encrypted.v1:${SOURCE}:${owner}`);
  } catch {
    return false;
  }
};

export function removeCachedResources(prefix, session) {
  try {
    const saved = currentDocument(session);
    if (!saved) return;
    for (const key of Object.keys(saved.entries)) {
      if (key.startsWith(prefix)) delete saved.entries[key];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(saved));
  } catch {
    clearBrowserCache();
  }
}
