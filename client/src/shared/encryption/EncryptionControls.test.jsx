import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EncryptionControls from "./EncryptionControls";
import { encryptionSession, lockEncryption } from "./session";
import { vaultStatus, syncVault, resolveVault } from "./vault";
jest.mock("./session");
jest.mock("./vault");
beforeEach(() => jest.resetAllMocks());
test("settings display conflict versions and apply only the explicitly selected choice", async () => {
  encryptionSession.mockReturnValue({});
  vaultStatus.mockReturnValue({
    pending: true,
    conflicts: ["note/id"],
    conflictItems: [
      { key: "note/id", local: { comment: "Local note" }, remote: { comment: "Remote note" } },
    ],
  });
  render(<EncryptionControls />);
  expect(screen.getByText("Local note")).toBeInTheDocument();
  expect(screen.getByText("Remote note")).toBeInTheDocument();
  expect(resolveVault).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep server versions" }));
  expect(resolveVault).toHaveBeenCalledWith("remote");
  await waitFor(() => expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled());
});
test("settings can synchronize and lock an unlocked account", async () => {
  encryptionSession.mockReturnValue({});
  vaultStatus.mockReturnValue({ pending: false, conflicts: [] });
  render(<EncryptionControls />);
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
  expect(syncVault).toHaveBeenCalled();
  const lock = screen.getByRole("button", { name: "Lock data" });
  await waitFor(() => expect(lock).toBeEnabled());
  fireEvent.click(lock);
  expect(lockEncryption).toHaveBeenCalled();
});
