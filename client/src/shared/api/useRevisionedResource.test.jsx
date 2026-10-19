import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import useRevisionedResource from "./useRevisionedResource";

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
const conflictMessage = "Changed. Reload before saving.";
function fixture() {
  const config = {
    initial: { revision: 0, tasks: [] },
    read: jest.fn().mockResolvedValue({ revision: 3, tasks: [] }),
    write: jest.fn().mockResolvedValue({ revision: 4, tasks: [{ id: "saved" }] }),
    conflictMessage,
    busyMessage: "Reload first",
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

test("stale revision conflicts preserve data and block saving until a successful reload", async () => {
  const { config, result } = fixture();
  await waitFor(() => expect(result.current.loading).toBe(false));
  config.write.mockRejectedValueOnce(Object.assign(new Error(conflictMessage), { status: 409 }));
  await act(async () => {
    await expect(result.current.send({})).rejects.toThrow(conflictMessage);
  });
  expect(result.current.conflict).toBe(true);
  expect(result.current.data.revision).toBe(3);
  await expect(result.current.send({})).rejects.toThrow("Reload first");
  config.read.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => result.current.reload());
  expect(result.current.conflict).toBe(true);
  await act(async () => result.current.reload());
  expect(result.current.conflict).toBe(false);
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
