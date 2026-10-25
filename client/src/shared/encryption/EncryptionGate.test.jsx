import { fireEvent, render, screen } from "@testing-library/react";
import EncryptionGate from "./EncryptionGate";
import { inspectVault, unlockVault, vaultStatus } from "./vault";
import { encryptionSession } from "./session";
jest.mock("./vault");
jest.mock("./session", () => ({ encryptionSession: jest.fn(), lockEncryption: jest.fn() }));
beforeEach(() => {
  jest.resetAllMocks();
  encryptionSession.mockReturnValue(null);
  vaultStatus.mockReturnValue({ pending: false, conflicts: [], legacyRetained: true });
});
test("the locked gate never renders calendar contents and unlocks only after successful decryption", async () => {
  inspectVault.mockResolvedValue({ encrypted: true, envelope: {} });
  unlockVault
    .mockRejectedValueOnce(new Error("Incorrect encryption passphrase or damaged data."))
    .mockResolvedValueOnce({});
  render(
    <EncryptionGate>
      <p>Private calendar content</p>
    </EncryptionGate>,
  );
  expect(screen.queryByText("Private calendar content")).not.toBeInTheDocument();
  const field = await screen.findByLabelText("Encryption passphrase");
  fireEvent.change(field, { target: { value: "wrong phrase" } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock data" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect");
  expect(screen.queryByText("Private calendar content")).not.toBeInTheDocument();
  fireEvent.change(field, { target: { value: "correct encryption phrase" } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock data" }));
  expect(await screen.findByText("Private calendar content")).toBeInTheDocument();
  expect(
    screen.getByText("Old unencrypted server copies are retained. Full migration is pending."),
  ).toBeInTheDocument();
  fireEvent(window, new Event("daymark:lock"));
  expect(screen.queryByText("Private calendar content")).not.toBeInTheDocument();
  expect(await screen.findByLabelText("Encryption passphrase")).toBeInTheDocument();
});
test("setup requires confirmation and explains the retained originals and recovery limits", async () => {
  inspectVault.mockResolvedValue({ encrypted: false });
  render(
    <EncryptionGate>
      <p>Private calendar content</p>
    </EncryptionGate>,
  );
  const create = await screen.findByRole("button", { name: "Prepare encryption" });
  expect(create).toBeDisabled();
  expect(
    screen.getByText(/Existing unencrypted server records will be retained/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Account password recovery cannot recover this phrase/),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Encryption passphrase"), {
    target: { value: "a new encryption phrase" },
  });
  fireEvent.change(screen.getByLabelText("Confirm encryption passphrase"), {
    target: { value: "different phrase" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(create);
  expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
  expect(unlockVault).not.toHaveBeenCalled();
});
test("server errors keep content locked and expose a working retry", async () => {
  inspectVault
    .mockRejectedValueOnce(new Error("Server unavailable"))
    .mockResolvedValueOnce({ encrypted: true });
  render(
    <EncryptionGate>
      <p>Private calendar content</p>
    </EncryptionGate>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByLabelText("Encryption passphrase")).toBeInTheDocument();
  expect(screen.queryByText("Private calendar content")).not.toBeInTheDocument();
});
