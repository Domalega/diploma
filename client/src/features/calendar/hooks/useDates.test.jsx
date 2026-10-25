import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import useDates from "./useDates";
import * as api from "../api/datesApi";
import {
  cacheSession,
  readCachedResource,
  saveCachedResource,
} from "../../../shared/api/browserCache";

jest.mock("../api/datesApi");
const note = { id: 1, date: "2026-10-19", time: null, comment: "Original" };
const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
  api.getAllDates.mockResolvedValue([note]);
});

test("saved notes appear immediately while the server is pending and survive an outage", async () => {
  localStorage.setItem("token", `header.${btoa(JSON.stringify({ id: 7 }))}.signature`);
  saveCachedResource("dates", [note], cacheSession());
  let reject;
  api.getAllDates.mockReturnValue(
    new Promise((resolve, fail) => {
      reject = fail;
    }),
  );
  const { result } = renderHook(useDates, { wrapper });
  expect(result.current.loading).toBe(false);
  expect(result.current.dates).toEqual([note]);
  await act(async () => reject(new Error("Offline")));
  expect(result.current.error).toBe("Offline");
  expect(result.current.dates).toEqual([note]);
  await act(async () => result.current.update(note.id, { comment: "Saved" }));
  expect(readCachedResource("dates")[0].comment).toBe("Saved");
  await act(async () => result.current.remove(note.id));
  expect(readCachedResource("dates")).toEqual([]);
});

test.each(["update", "remove"])("an old read cannot undo a successful %s", async (action) => {
  const { result } = renderHook(useDates, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const stale = deferred();
  api.getAllDates.mockReturnValueOnce(stale.promise);
  let reading;
  act(() => {
    reading = result.current.reload();
  });
  const signal = api.getAllDates.mock.calls[1][0];
  await act(async () => {
    if (action === "update") await result.current.update(note.id, { comment: "Saved" });
    else await result.current.remove(note.id);
  });
  expect(signal.aborted).toBe(true);
  await act(async () => {
    stale.resolve([note]);
    await reading;
  });
  expect(result.current.dates).toEqual(action === "update" ? [{ ...note, comment: "Saved" }] : []);
});

test("sync refresh waits for an in-flight write before reading", async () => {
  const { result } = renderHook(useDates, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const saved = deferred();
  api.updateDate.mockReturnValueOnce(saved.promise);
  let writing;
  act(() => {
    writing = result.current.update(note.id, { comment: "Saved" });
  });
  act(() => window.dispatchEvent(new Event("daymark:sync")));
  expect(api.getAllDates).toHaveBeenCalledTimes(1);
  api.getAllDates.mockResolvedValue([{ ...note, comment: "Saved" }]);
  await act(async () => {
    saved.resolve({});
    await writing;
  });
  expect(api.getAllDates).toHaveBeenCalledTimes(2);
  expect(result.current.dates[0].comment).toBe("Saved");
});

test("only the latest reload can finish loading or replace notes", async () => {
  const first = deferred(),
    second = deferred();
  api.getAllDates.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result } = renderHook(useDates, { wrapper });
  let reading;
  act(() => {
    reading = result.current.reload();
  });
  await act(async () => first.resolve([note]));
  expect(result.current.loading).toBe(true);
  expect(result.current.dates).toEqual([]);
  await act(async () => {
    second.resolve([{ ...note, comment: "Latest" }]);
    await reading;
  });
  expect(result.current.loading).toBe(false);
  expect(result.current.dates[0].comment).toBe("Latest");
});
