import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EncryptionGate from "./EncryptionGate";
import EncryptionControls from "./EncryptionControls";
import {
  initializeDeviceAccess,
  restoreDeviceAccess,
  enableDeviceEncryption,
  approveDeviceConnection,
  parseConnection,
} from "./deviceFlow";
import { vaultStatus, syncVault } from "./vault";
import { encryptionSession } from "./session";
jest.mock("./deviceFlow");
jest.mock("./vault");
jest.mock("./session", () => ({ encryptionSession: jest.fn(), lockEncryption: jest.fn() }));
beforeEach(() => {
  jest.resetAllMocks();
  encryptionSession.mockReturnValue(null);
  restoreDeviceAccess.mockResolvedValue(null);
  syncVault.mockResolvedValue(undefined);
  vaultStatus.mockReturnValue({ pending: false, conflicts: [], legacyRetained: false });
});
const open = (entry = "/calendar") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <EncryptionGate>
        <p>Private calendar content</p>
        <EncryptionControls />
      </EncryptionGate>
    </MemoryRouter>,
  );
test("ordinary accounts open normally and encryption is a separate optional settings action without a phrase", async () => {
  initializeDeviceAccess.mockResolvedValue({ mode: "plain", status: { encrypted: false } });
  enableDeviceEncryption.mockImplementation(async () => {
    encryptionSession.mockReturnValue({});
    return { mode: "ready", status: { encrypted: true } };
  });
  open();
  expect(await screen.findByText("Private calendar content")).toBeInTheDocument();
  expect(screen.queryByLabelText("Encryption passphrase")).not.toBeInTheDocument();
  expect(enableDeviceEncryption).not.toHaveBeenCalled();
  const button = screen.getByRole("button", { name: "Enable encryption" });
  expect(button).toHaveClass("btn", "theme-button");
  fireEvent.click(button);
  expect(await screen.findByRole("button", { name: "Sync now" })).toHaveClass(
    "btn",
    "theme-button-outline",
  );
  expect(enableDeviceEncryption).toHaveBeenCalledTimes(1);
});
test("saved ordinary data stays visible while the encryption check stalls or fails", async () => {
  restoreDeviceAccess.mockResolvedValue({ mode: "plain" });
  let fail;
  initializeDeviceAccess.mockReturnValue(new Promise((resolve, reject) => (fail = reject)));
  open();
  expect(await screen.findByText("Private calendar content")).toBeInTheDocument();
  expect(screen.queryByText("Opening your calendar…")).not.toBeInTheDocument();
  await act(async () => fail(new TypeError("Offline")));
  expect(screen.getByText("Private calendar content")).toBeInTheDocument();
});

test("a restored encrypted document opens while background synchronization is stalled", async () => {
  restoreDeviceAccess.mockImplementation(async () => {
    encryptionSession.mockReturnValue({});
    return { mode: "ready" };
  });
  syncVault.mockReturnValue(new Promise(() => {}));
  open();
  expect(await screen.findByText("Private calendar content")).toBeInTheDocument();
  expect(initializeDeviceAccess).not.toHaveBeenCalled();
  expect(syncVault).toHaveBeenCalledTimes(1);
});

test("an unapproved device cannot display encrypted contents and does not ask for a new phrase", async () => {
  initializeDeviceAccess.mockResolvedValue({
    mode: "waiting",
    link: "https://example.test/#/calendar?connect=public-key",
    code: "abcd1234",
  });
  open();
  expect(await screen.findByText("Connect this device")).toBeInTheDocument();
  expect(screen.queryByText("Private calendar content")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Encryption passphrase")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy connection link" })).toHaveClass(
    "btn",
    "theme-button-outline",
  );
  expect(screen.getByRole("button", { name: "Retry" })).toHaveClass("btn", "theme-button-outline");
  expect(screen.getByLabelText("Device connection link")).toHaveAttribute("readonly");
});
test("connected devices open automatically without any user input", async () => {
  encryptionSession.mockReturnValue({});
  initializeDeviceAccess.mockResolvedValue({ mode: "ready", status: { encrypted: true } });
  open();
  await waitFor(() => expect(initializeDeviceAccess).toHaveBeenCalled());
  expect(await screen.findByText("Private calendar content")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Lock data" })).not.toBeInTheDocument();
});
test("a connection link does not share the key until the owner explicitly approves the device", async () => {
  encryptionSession.mockReturnValue({});
  initializeDeviceAccess.mockResolvedValue({ mode: "ready", status: { encrypted: true } });
  const request = { owner: "7", id: "12345678-device", publicKey: {} };
  parseConnection.mockReturnValue(request);
  approveDeviceConnection.mockResolvedValue({});
  open("/calendar?connect=public-key");
  await waitFor(() => expect(initializeDeviceAccess).toHaveBeenCalled());
  const approve = await screen.findByRole("button", { name: "Approve device" });
  expect(approveDeviceConnection).not.toHaveBeenCalled();
  expect(approve).toHaveClass("btn", "theme-button");
  fireEvent.click(approve);
  await waitFor(() => expect(approveDeviceConnection).toHaveBeenCalledWith(request));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
test("a failed access check exposes a styled retry and retains the protection boundary", async () => {
  initializeDeviceAccess
    .mockRejectedValueOnce(new Error("Server unavailable"))
    .mockResolvedValueOnce({ mode: "plain" });
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
  expect(screen.queryByText("Private calendar content")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Private calendar content")).toBeInTheDocument();
});
