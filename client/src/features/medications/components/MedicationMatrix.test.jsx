import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import MedicationMatrix from "./MedicationMatrix";
import { EVERY_DAY, matrixForDay } from "../utils/schedule";
const date = "2026-10-14";
const plan = {
  enabled: true,
  slots: [
    { id: "morning", time: "08:00", label: "Morning" },
    { id: "night", time: "22:00", label: "Night" },
  ],
  rows: [
    {
      id: "a",
      name: "Example A",
      detail: "",
      slotIds: ["morning", "night"],
      weekdays: EVERY_DAY,
      startDate: "2026-10-01",
      endDate: null,
    },
    {
      id: "b",
      name: "Example B",
      detail: "",
      slotIds: ["morning"],
      weekdays: [3],
      startDate: "2026-10-01",
      endDate: null,
    },
  ],
};

test("edge actions open the correct schedule editor without permanent add rows or columns", () => {
  const onConfigure = jest.fn();
  render(
    <MedicationMatrix
      date={date}
      tracker={{ plan, records: [], loading: false }}
      onConfigure={onConfigure}
    />,
  );
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
  expect(within(table).getAllByRole("rowgroup")).toHaveLength(2);
  expect(table).toHaveAccessibleDescription(
    "Times follow your device's local clock. Unscheduled cells stay empty.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Add intake time" }));
  expect(onConfigure).toHaveBeenLastCalledWith({ section: "times", create: true });
  fireEvent.click(screen.getByRole("button", { name: "Add medication" }));
  expect(onConfigure).toHaveBeenLastCalledWith({ section: "medications", create: true });
});
function Fixture({ fail = false, initial = [], standalone = false, onConfigure = () => {} }) {
  const [records, setRecords] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function mark(values, whole) {
    setPending(true);
    try {
      if (fail) {
        setError("Could not save intake");
        throw new Error("Could not save intake");
      }
      const ids = whole
        ? plan.rows.filter((row) => row.slotIds.includes(values.slotId)).map((row) => row.id)
        : [values.medicationId];
      setRecords((previous) => {
        const remaining = previous.filter(
          (record) => !(record.slotId === values.slotId && ids.includes(record.medicationId)),
        );
        return values.taken
          ? [
              ...remaining,
              ...ids.map((id) => ({
                medicationId: id,
                slotId: values.slotId,
                date,
                takenAt: "2026-10-14T08:00:00Z",
              })),
            ]
          : remaining;
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <MedicationMatrix
      standalone={standalone}
      date={date}
      tracker={{ plan, records, pending, error, loading: false, mark, reload() {} }}
      onConfigure={onConfigure}
      onExpand={() => {}}
    />
  );
}
test("unscheduled cells cannot be marked and a column celebrates only when its last cell completes", async () => {
  render(<Fixture />);
  expect(screen.getAllByLabelText("Not scheduled")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: /Example B at 22:00/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Example A at 08:00/ }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Example A at 08:00/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  expect(screen.getByRole("status", { name: "Medication update" })).not.toHaveTextContent(
    "All scheduled",
  );
  fireEvent.click(screen.getByRole("button", { name: /Example B at 08:00/ }));
  await waitFor(() =>
    expect(screen.getByRole("status", { name: "Medication update" })).toHaveTextContent(
      "All scheduled items for 08:00",
    ),
  );
  expect(await screen.findByTestId("medication-column-completion")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Uncheck scheduled medications at 08:00/ }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Example A at 08:00/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    ),
  );
  expect(screen.getByRole("button", { name: /Example B at 08:00/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
test("whole-column marking changes only assigned cells and a failed save preserves earlier marks", async () => {
  const initial = [{ medicationId: "a", slotId: "morning", date, takenAt: "2026-10-14T08:00:00Z" }];
  const view = render(<Fixture initial={initial} fail />);
  fireEvent.click(screen.getByRole("button", { name: /Mark all scheduled medications at 08:00/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save intake");
  expect(screen.getByRole("button", { name: /Example A at 08:00/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: /Example B at 08:00/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  view.unmount();
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: /Mark all scheduled medications at 08:00/ }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Example B at 08:00/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  expect(screen.getByRole("button", { name: /Example A at 22:00/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
test("initial marks do not replay the completion effect and celebration timers are cleaned up", async () => {
  jest.useFakeTimers();
  const view = render(
    <Fixture
      initial={[{ medicationId: "a", slotId: "night", date, takenAt: "2026-10-14T22:00:00Z" }]}
    />,
  );
  expect(screen.queryByTestId("medication-column-completion")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Mark all scheduled medications at 08:00/ }));
  expect(await screen.findByTestId("medication-column-completion")).toBeInTheDocument();
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
test("removed rows and columns still show the snapshots of previously recorded intakes", () => {
  const result = matrixForDay(
    { rows: [], slots: [] },
    [
      {
        medicationId: "removed",
        slotId: "removed-slot",
        nameSnapshot: "Previous label",
        detailSnapshot: "",
        timeSnapshot: "09:00",
        slotLabelSnapshot: "Morning",
        date,
      },
    ],
    date,
  );
  expect(result.rows[0]).toMatchObject({ name: "Previous label", historical: true });
  expect(result.slots[0]).toMatchObject({ time: "09:00", historical: true });
  expect(result.scheduled(result.rows[0], result.slots[0])).toBe(false);
});

test("a completed request for the previous day does not celebrate on the newly selected day", async () => {
  let finish;
  const mark = jest.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tracker = { plan, records: [], loading: false, pending: false, mark };
  const view = render(<MedicationMatrix date={date} tracker={tracker} />);
  fireEvent.click(screen.getByRole("button", { name: /Mark all scheduled medications at 08:00/ }));
  view.rerender(<MedicationMatrix date="2026-10-15" tracker={tracker} />);
  await act(async () => finish([]));
  expect(screen.queryByTestId("medication-column-completion")).not.toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Medication update" })).toBeEmptyDOMElement();
});

test("a tall narrow tile transposes time headings, preserves marks, and remaps add edges", async () => {
  const originalObserver = global.ResizeObserver;
  let notify;
  let allocated = { width: 460, height: 586 };
  const observe = jest.fn();
  const disconnect = jest.fn();
  global.ResizeObserver = class {
    constructor(callback) {
      notify = callback;
    }
    observe = observe;
    disconnect = disconnect;
  };
  const geometry = jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function () {
      // Content is deliberately wide: only the tile's allocated space must drive orientation.
      return this.classList.contains("dashboard-tile") ? allocated : { width: 1000, height: 200 };
    });
  const onConfigure = jest.fn();
  try {
    const view = render(
      <div className="dashboard-tile" data-testid="allocated-tile">
        <div className="dashboard-tile-body">
          <Fixture standalone onConfigure={onConfigure} />
        </div>
      </div>,
    );
    expect(observe).toHaveBeenCalledWith(screen.getByTestId("allocated-tile"));
    expect(screen.getByRole("table")).toHaveClass("is-transposed");
    expect(screen.getByRole("columnheader", { name: "Example A" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /08:00/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add medication" })).toHaveClass("matrix-add-column");
    expect(screen.getByRole("button", { name: "Add intake time" })).toHaveClass("matrix-add-row");
    fireEvent.click(screen.getByRole("button", { name: "Add medication" }));
    expect(onConfigure).toHaveBeenLastCalledWith({ section: "medications", create: true });
    fireEvent.click(screen.getByRole("button", { name: "Add intake time" }));
    expect(onConfigure).toHaveBeenLastCalledWith({ section: "times", create: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Mark all scheduled medications at 08:00/ }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Example B at 08:00/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(await screen.findByTestId("medication-column-completion")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Example B at 22:00/ })).not.toBeInTheDocument();
    allocated = { width: 640, height: 650 };
    act(() => notify());
    expect(screen.getByRole("table")).toHaveClass("is-transposed");
    allocated = { width: 900, height: 400 };
    act(() => notify());
    expect(screen.getByRole("table")).not.toHaveClass("is-transposed");
    expect(screen.getByRole("columnheader", { name: /08:00/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Example B at 08:00/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Add medication" })).toHaveClass("matrix-add-row");
    allocated = { width: 360, height: 650 };
    act(() => notify());
    fireEvent.click(screen.getByRole("button", { name: /Uncheck scheduled medications at 08:00/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Example A at 08:00/ })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  } finally {
    geometry.mockRestore();
    global.ResizeObserver = originalObserver;
  }
});
