import { AppUpdatesProvider } from "./AppUpdatesProvider";
import { act, fireEvent, render as renderUi, screen, waitFor } from "@testing-library/react";
import { AppUpdateBanner, AppUpdateSettings } from "./AppUpdates";
import { supportsAppUpdates, updateNative } from "./bridge";
jest.mock("./bridge");
const render = (children) => renderUi(<AppUpdatesProvider>{children}</AppUpdatesProvider>);
const installed = { installedVersion: "0.3.0", checkedAt: 123456, notifications: true };
beforeEach(() => {
  jest.clearAllMocks();
  supportsAppUpdates.mockReturnValue(true);
  updateNative.mockResolvedValue(installed);
});

test("ordinary browsers have no Android update controls", () => {
  supportsAppUpdates.mockReturnValue(false);
  render(
    <>
      <AppUpdateSettings />
      <AppUpdateBanner />
    </>,
  );
  expect(screen.queryByText("App updates")).not.toBeInTheDocument();
  expect(updateNative).not.toHaveBeenCalled();
});

test("checking a version never starts a download until the user asks", async () => {
  const candidate = { versionCode: 4, versionName: "0.3.1", notes: "Improved calendar" };
  updateNative.mockImplementation(async (action) =>
    action === "status" ? installed : { ...installed, candidate },
  );
  render(<AppUpdateSettings />);
  expect(await screen.findByText("Installed version: 0.3.0")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));
  expect(await screen.findByText("Daymark 0.3.1 is available")).toBeInTheDocument();
  expect(updateNative).not.toHaveBeenCalledWith("install");
  fireEvent.click(screen.getByRole("button", { name: "Download and update" }));
  await waitFor(() => expect(updateNative).toHaveBeenCalledWith("install"));
});

test("failed checks are visible and can be retried", async () => {
  render(<AppUpdateSettings />);
  await screen.findByText("Installed version: 0.3.0");
  updateNative.mockRejectedValueOnce(new Error("Network unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
  expect(screen.getByRole("button", { name: "Check for updates" })).toBeEnabled();
});

test("a downloaded update offers installation and a notification can be deferred", async () => {
  updateNative.mockResolvedValue({
    ...installed,
    candidate: { versionCode: 4, versionName: "0.3.1" },
    ready: true,
  });
  render(<AppUpdateBanner />);
  expect(await screen.findByRole("button", { name: "Install update" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

test("download progress offers no duplicate download button", async () => {
  updateNative.mockResolvedValue({
    ...installed,
    candidate: { versionCode: 4, versionName: "0.3.1" },
    downloading: true,
    progress: 47,
  });
  render(<AppUpdateBanner />);
  expect(await screen.findByText("Downloading update… 47%")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Download and update" })).not.toBeInTheDocument();
});

afterEach(() => jest.useRealTimers());

test("banner and settings share one status request and use faster polling only during downloads", async () => {
  jest.useFakeTimers();
  render(
    <>
      <AppUpdateBanner />
      <AppUpdateSettings />
    </>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(updateNative).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(59999));
  expect(updateNative).toHaveBeenCalledTimes(1);
  updateNative.mockResolvedValue({
    ...installed,
    downloading: true,
    progress: 10,
    candidate: { versionCode: 4, versionName: "0.3.1" },
  });
  await act(async () => jest.advanceTimersByTime(1));
  expect(updateNative).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(2500));
  expect(updateNative).toHaveBeenCalledTimes(3);
});

test("a stale automatic status cannot overwrite the result of a manual check", async () => {
  let finish;
  updateNative
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ ...installed, candidate: { versionCode: 4, versionName: "0.3.1" } });
  render(<AppUpdateSettings />);
  fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));
  expect(await screen.findByText("Daymark 0.3.1 is available")).toBeInTheDocument();
  await act(async () => finish(installed));
  expect(screen.getByText("Daymark 0.3.1 is available")).toBeInTheDocument();
});

test("hidden pages and pending polls do not issue repeated status calls", async () => {
  jest.useFakeTimers();
  let finish;
  updateNative.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<AppUpdateSettings />);
  await act(async () => jest.advanceTimersByTime(120000));
  expect(updateNative).toHaveBeenCalledTimes(1);
  await act(async () => finish(installed));
  const descriptor = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  try {
    await act(async () => jest.advanceTimersByTime(120000));
    expect(updateNative).toHaveBeenCalledTimes(1);
  } finally {
    if (descriptor) Object.defineProperty(document, "hidden", descriptor);
    else delete document.hidden;
  }
  fireEvent(window, new Event("focus"));
  await act(async () => {
    await Promise.resolve();
  });
  expect(updateNative).toHaveBeenCalledTimes(2);
});
