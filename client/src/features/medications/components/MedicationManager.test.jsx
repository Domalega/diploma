import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MedicationManager from "./MedicationManager";
const slotId = "842bc81c-68db-4a37-a8bc-56e7f8e27f70";
beforeEach(() => {
  Object.defineProperty(window, "crypto", {
    configurable: true,
    value: { randomUUID: jest.fn(() => "0b0a6ee1-eabe-4f52-9d37-26f7b38b4cbd") },
  });
});
test("medications use phone-style weekdays and selected times without losing course dates", async () => {
  const save = jest.fn(async () => {});
  render(
    <MedicationManager
      intent={{ section: "medications", create: true }}
      tracker={{
        plan: { slots: [{ id: slotId, time: "08:00", label: "Morning" }], rows: [] },
        savePlan: save,
        reload() {},
      }}
      onClose={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Medication name"), { target: { value: "Example A" } });
  for (const day of ["Tuesday", "Thursday", "Saturday", "Sunday"])
    fireEvent.click(screen.getByRole("button", { name: day, exact: true }));
  fireEvent.input(screen.getByLabelText("Start date"), { target: { value: "2026-10-01" } });
  fireEvent.input(screen.getByLabelText("End date (optional)"), {
    target: { value: "2026-10-31" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save medication" }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].rows[0]).toMatchObject({
    name: "Example A",
    weekdays: [1, 3, 5],
    slotIds: [slotId],
    startDate: "2026-10-01",
    endDate: "2026-10-31",
  });
});
test("native time input is saved immediately and the only assigned column cannot be removed", async () => {
  const save = jest.fn();
  const view = render(
    <MedicationManager
      intent={{ section: "times", create: true }}
      tracker={{ plan: { rows: [], slots: [] }, savePlan: save.mockResolvedValue({}), reload() {} }}
      onClose={() => {}}
    />,
  );
  fireEvent.input(screen.getByLabelText("Intake time"), { target: { value: "00:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Save intake time" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({ slots: [expect.objectContaining({ time: "00:00" })] }),
  );
  view.unmount();
  save.mockClear();
  render(
    <MedicationManager
      intent={{ section: "times" }}
      tracker={{
        plan: {
          rows: [{ id: "a", name: "Example A", slotIds: [slotId] }],
          slots: [{ id: slotId, time: "08:00", label: "Morning" }],
        },
        savePlan: save,
        reload() {},
      }}
      onClose={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove intake time 08:00" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove from schedule" }));
  expect(screen.getByRole("alert")).toHaveTextContent("only intake time");
  expect(save).not.toHaveBeenCalled();
});
