import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SyncStatus from "./SyncStatus";
import { isOfflineApp, offlineNative } from "./bridge";
jest.mock("./bridge");
beforeEach(() => {
  jest.clearAllMocks();
  isOfflineApp.mockReturnValue(true);
});
test("a normal browser has no misleading phone-storage indicator", () => {
  isOfflineApp.mockReturnValue(false);
  render(
    <MemoryRouter>
      <SyncStatus />
    </MemoryRouter>,
  );
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});
test("pending changes and both conflict versions are visible before choosing", async () => {
  offlineNative.mockResolvedValue({
    ready: true,
    pending: 2,
    syncRevision: 1,
    conflicts: [
      { key: "todo/one", local: { title: "Phone task" }, remote: { title: "Server task" } },
    ],
  });
  render(
    <MemoryRouter>
      <SyncStatus />
    </MemoryRouter>,
  );
  expect(await screen.findByText("2 changes saved on this phone")).toBeInTheDocument();
  expect(screen.getByText("Phone task")).toBeInTheDocument();
  expect(screen.getByText("Server task")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Keep phone versions" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Keep phone versions" })).toBeEnabled(),
  );
  await waitFor(() =>
    expect(offlineNative).toHaveBeenCalledWith(
      "resolve",
      expect.objectContaining({ choice: "local" }),
    ),
  );
});
