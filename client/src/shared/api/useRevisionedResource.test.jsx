import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import useRevisionedResource from "./useRevisionedResource";
import { cacheSession, readCachedResource, saveCachedResource } from "./browserCache";

beforeEach(() => localStorage.clear());

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
const conflictMessage = "Changed. Reload before saving.";
function fixture() {
  const config = {
    initial: { revision: 0, tasks: [] },
    read: jest.fn().mockResolvedValue({ revision: 3, tasks: [] }),
    write: jest.fn().mockResolvedValue({ revision: 4, tasks: [{ id: "saved" }] }),
    conflictMessage,
    busyMessage: "Reload first",
    refreshOnConflict: true,
  };
  return { config, ...renderHook(() => useRevisionedResource(config), { wrapper }) };
}

test("writes use the latest revision and concurrent commands are rejected", async () => {
  const { config, result } = fixture();
  await waitFor(() => expect(result.current.loading).toBe(false));
  let finish, saving;
  config.write.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => {
    saving = result.current.send({ type: "add" });
  });
  await expect(result.current.send({ type: "add" })).rejects.toThrow("Reload first");
  expect(config.write).toHaveBeenCalledTimes(1);
  expect(config.write).toHaveBeenCalledWith({ type: "add", revision: 3 });
  await act(async () => {
    finish({ revision: 4, tasks: [] });
    await saving;
  });
  await act(async () => result.current.send({ type: "add" }));
  expect(config.write).toHaveBeenLastCalledWith({ type: "add", revision: 4 });
});

test("cached tasks remain interactive during refresh and a late read cannot undo a save", async () => {
  localStorage.setItem("token", `header.${btoa(JSON.stringify({ id: 7 }))}.signature`);
  const saved = { enabled: true, revision: 3, tasks: [{ id: "cached" }] };
  saveCachedResource("todos", saved, cacheSession());
  let finish;
  const config = {
    initial: { revision: 0, tasks: [] },
    cacheKey: "todos",
    read: jest.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
    write: jest.fn().mockResolvedValue({ ...saved, revision: 4, tasks: [] }),
    conflictMessage,
    busyMessage: "Reload first",
  };
  const { result } = renderHook(() => useRevisionedResource(config), { wrapper });
  expect(result.current.loading).toBe(false);
  expect(result.current.data).toEqual(saved);
  await act(async () => result.current.send({ type: "remove" }));
  expect(config.write).toHaveBeenCalledWith({ type: "remove", revision: 3 });
  await act(async () => finish(saved));
  expect(result.current.data.tasks).toEqual([]);
  expect(readCachedResource("todos").revision).toBe(4);
});

test("stale revision conflicts reload automatically and keep saving blocked if that read fails", async () => {
  const { config, result } = fixture();
  await waitFor(() => expect(result.current.loading).toBe(false));
  config.read.mockRejectedValueOnce(new Error("Offline"));
  config.write.mockRejectedValueOnce(Object.assign(new Error(conflictMessage), { status: 409 }));
  await act(async () => {
    await expect(result.current.send({})).rejects.toThrow(conflictMessage);
  });
  expect(result.current.conflict).toBe(true);
  expect(result.current.data.revision).toBe(3);
  expect(config.read).toHaveBeenCalledTimes(2);
  await expect(result.current.send({})).rejects.toThrow("Reload first");
  await act(async () => result.current.reload());
  expect(result.current.conflict).toBe(false);
});

test("a stale revision refreshes in the background without replaying the rejected command", async () => {
  const { config, result } = fixture();
  await waitFor(() => expect(result.current.loading).toBe(false));
  config.write.mockRejectedValueOnce(Object.assign(new Error(conflictMessage), { status: 409 }));
  config.read.mockResolvedValueOnce({ revision: 4, tasks: [{ id: "from-another-tab" }] });
  await act(async () => {
    await expect(result.current.send({ type: "add" })).rejects.toThrow(conflictMessage);
  });
  await waitFor(() => expect(result.current.data.revision).toBe(4));
  expect(result.current.error).toBe("");
  expect(result.current.conflict).toBe(false);
  expect(config.write).toHaveBeenCalledTimes(1);
  await act(async () => result.current.send({ type: "add" }));
  expect(config.write).toHaveBeenLastCalledWith({ type: "add", revision: 4 });
});

test("WIP conflicts allow retry and sync refresh waits for the pending write", async () => {
  const { config, result } = fixture();
  await waitFor(() => expect(result.current.loading).toBe(false));
  config.write.mockRejectedValueOnce(Object.assign(new Error("WIP limit"), { status: 409 }));
  await act(async () => {
    await expect(result.current.send({})).rejects.toThrow("WIP limit");
  });
  expect(result.current.conflict).toBe(false);
  let finish, saving;
  config.write.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => {
    saving = result.current.send({});
  });
  act(() => window.dispatchEvent(new Event("daymark:sync")));
  expect(config.read).toHaveBeenCalledTimes(1);
  config.read.mockResolvedValue({ revision: 5, tasks: [] });
  await act(async () => {
    finish({ revision: 4, tasks: [] });
    await saving;
  });
  await waitFor(() => expect(result.current.data.revision).toBe(5));
});
