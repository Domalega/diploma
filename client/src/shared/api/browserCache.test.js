import {
  cacheSession,
  readCachedResource,
  saveCachedResource,
  hasCachedCalendar,
} from "./browserCache";
import { setToken, clearToken } from "./tokenStorage";

const token = (id, suffix = "signature") => `header.${btoa(JSON.stringify({ id }))}.${suffix}`;
const key = "daymark.web-data.v1";
beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test("data survives a page session and token renewal for the same account", () => {
  setToken(token(7));
  const session = cacheSession();
  saveCachedResource("dates", [], session);
  setToken(token(7, "renewed"));
  expect(cacheSession()).toEqual(session);
  expect(hasCachedCalendar()).toBe(true);
  expect(readCachedResource("dates")).toEqual([]);
});

test("switching accounts and signing out discard copies and reject late saves", () => {
  setToken(token(7));
  const old = cacheSession();
  saveCachedResource("dates", [{ id: 1 }], old);
  setToken(token(8));
  const next = cacheSession();
  saveCachedResource("dates", [{ id: 2 }], next);
  saveCachedResource("dates", [{ id: 1 }], old);
  expect(readCachedResource("dates")).toEqual([{ id: 2 }]);
  clearToken();
  setToken(token(8));
  cacheSession();
  saveCachedResource("dates", [{ id: 2 }], next);
  expect(hasCachedCalendar()).toBe(false);
});

test("malformed storage, unknown tokens and a different API cannot supply a copy", () => {
  setToken("invalid-token");
  expect(cacheSession()).toBeNull();
  setToken(token(7));
  localStorage.setItem(key, "{broken");
  expect(readCachedResource("dates")).toBeUndefined();
  localStorage.removeItem(key);
  saveCachedResource("dates", [], cacheSession());
  const saved = JSON.parse(localStorage.getItem(key));
  localStorage.setItem(key, JSON.stringify({ ...saved, source: "https://other.example/api" }));
  expect(hasCachedCalendar()).toBe(false);
});

test("the cache is bounded and preserves unrelated preferences", () => {
  setToken(token(7));
  localStorage.setItem("calendar.theme", "dark");
  const session = cacheSession();
  for (let day = 0; day < 45; day++) saveCachedResource("intakes:" + day, [], session);
  expect(Object.keys(JSON.parse(localStorage.getItem(key)).entries)).toHaveLength(40);
  expect(readCachedResource("intakes:44")).toEqual([]);
  expect(localStorage.getItem("calendar.theme")).toBe("dark");
});

test("quota failures discard a stale copy without failing the server save", () => {
  setToken(token(7));
  const session = cacheSession();
  saveCachedResource("dates", [{ id: 1 }], session);
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Quota exceeded");
  });
  expect(() => saveCachedResource("dates", [], session)).not.toThrow();
  expect(localStorage.getItem(key)).toBeNull();
});

test("Android continues to use its native database", () => {
  setToken(token(7));
  window.DaymarkOffline = { postMessage() {} };
  try {
    expect(cacheSession()).toBeNull();
    expect(readCachedResource("dates")).toBeUndefined();
  } finally {
    delete window.DaymarkOffline;
  }
});
