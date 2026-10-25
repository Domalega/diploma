import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import EncryptionControls from "./EncryptionControls";
import { encryptionSession } from "./session";
import { vaultStatus, syncVault, resolveVault } from "./vault";
import { EncryptionContext } from "./EncryptionContext";
jest.mock("./session");
jest.mock("./vault");
beforeEach(() => jest.resetAllMocks());
test("disabling requires explicit confirmation and keeps errors available for retry", async () => {
  encryptionSession.mockReturnValue({});
  vaultStatus.mockReturnValue({ conflicts: [] });
  const disable = jest.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce();
  render(
    <EncryptionContext.Provider value={{ disable }}>
      <EncryptionControls />
    </EncryptionContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Disable encryption" }));
  expect(disable).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  expect(disable).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Disable encryption" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Disable encryption" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Disable encryption" }),
  );
  await waitFor(() => expect(disable).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("a pasted connection link is reviewed before approval", () => {
  encryptionSession.mockReturnValue({});
  vaultStatus.mockReturnValue({ conflicts: [] });
  const connect = jest.fn(() => {
    throw new Error("invalid");
  });
  render(
    <EncryptionContext.Provider value={{ connect }}>
      <EncryptionControls />
    </EncryptionContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Connect another device" }));
  const review = screen.getByRole("button", { name: "Review connection" });
  expect(review).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Connection link from your other device"), {
    target: { value: "invalid link" },
  });
  fireEvent.click(review);
  expect(connect).toHaveBeenCalledWith("invalid link");
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid device connection");
  connect.mockImplementation(() => {});
  fireEvent.change(screen.getByLabelText("Connection link from your other device"), {
    target: { value: " https://example.test/#/calendar?connect=public-request " },
  });
  fireEvent.click(review);
  expect(connect).toHaveBeenLastCalledWith(
    "https://example.test/#/calendar?connect=public-request",
  );
});
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
test("settings synchronize with shared button styling and no phrase-based lock", async () => {
  encryptionSession.mockReturnValue({});
  vaultStatus.mockReturnValue({ pending: false, conflicts: [] });
  render(<EncryptionControls />);
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
  expect(syncVault).toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled());
  expect(screen.getByRole("button", { name: "Sync now" })).toHaveClass(
    "btn",
    "theme-button-outline",
  );
  expect(screen.queryByRole("button", { name: "Lock data" })).not.toBeInTheDocument();
});
