import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import DashboardBoard from "./DashboardBoard";
import { normalizePanelOrder, PANEL_LAYOUT_KEY, PANEL_ORDER } from "../hooks/usePanelLayout";

const panels = {
  calendar: { title: "Calendar", content: <p>Month view</p> },
  today: { title: "Today", content: <p>Current date</p> },
  notes: {
    title: "Notes",
    content: <input aria-label="Unsaved test draft" defaultValue="Keep me" />,
  },
  medications: { title: "Medication tracker", content: <p>Intake table</p> },
};
const visibleOrder = () =>
  within(screen.getByRole("group", { name: "Calendar panels" }))
    .getAllByRole("region")
    .map((element) => element.getAttribute("data-panel-id"));
beforeEach(() => localStorage.clear());

test("moving with the controls or keyboard preserves panel content and persists the same reading order", () => {
  let view = render(<DashboardBoard panels={panels} />);
  fireEvent.change(screen.getByLabelText("Unsaved test draft"), {
    target: { value: "Still editing" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  fireEvent.click(screen.getByRole("button", { name: "Move Medication tracker earlier" }));
  expect(visibleOrder()).toEqual(["calendar", "today", "medications", "notes"]);
  fireEvent.keyDown(screen.getByRole("button", { name: "Drag Medication tracker panel" }), {
    key: "ArrowUp",
  });
  expect(visibleOrder()).toEqual(["calendar", "medications", "today", "notes"]);
  expect(screen.getByLabelText("Unsaved test draft")).toHaveValue("Still editing");
  expect(JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY))).toEqual(visibleOrder());
  expect(screen.getByRole("button", { name: "Drag Medication tracker panel" })).toHaveFocus();
  view.unmount();
  view = render(<DashboardBoard panels={panels} />);
  expect(visibleOrder()).toEqual(["calendar", "medications", "today", "notes"]);
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));
  expect(visibleOrder()).toEqual(PANEL_ORDER);
});

test("the disabled medication tile keeps its saved place and invalid stored values cannot hide panels", () => {
  localStorage.setItem(
    PANEL_LAYOUT_KEY,
    JSON.stringify(["medications", "today", "today", "unknown"]),
  );
  const view = render(<DashboardBoard panels={{ ...panels, medications: null }} />);
  expect(visibleOrder()).toEqual(["today", "calendar", "notes"]);
  view.rerender(<DashboardBoard panels={panels} />);
  expect(visibleOrder()).toEqual(["medications", "today", "calendar", "notes"]);
  expect(normalizePanelOrder({ calendar: true })).toEqual(PANEL_ORDER);
});

function pointerEvent(element, type, values = {}) {
  const event = createEvent[type](element, { bubbles: true, cancelable: true });
  Object.entries({
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 100,
    ...values,
  }).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
  fireEvent(element, event);
}
test("dragging moves only on release and Escape cancels without changing the stored layout", () => {
  const original = document.elementFromPoint;
  render(<DashboardBoard panels={panels} />);
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  const handle = screen.getByRole("button", { name: "Drag Medication tracker panel" });
  document.elementFromPoint = () => screen.getByRole("region", { name: "Calendar", exact: true });
  try {
    pointerEvent(handle, "pointerDown");
    pointerEvent(handle, "pointerMove", { clientX: 130 });
    expect(visibleOrder()).toEqual(PANEL_ORDER);
    fireEvent.keyDown(window, { key: "Escape" });
    pointerEvent(handle, "pointerUp", { clientX: 130 });
    expect(localStorage.getItem(PANEL_LAYOUT_KEY)).toBeNull();
    pointerEvent(handle, "pointerDown");
    pointerEvent(handle, "pointerMove", { clientX: 130 });
    pointerEvent(handle, "pointerUp", { clientX: 130 });
    expect(visibleOrder()).toEqual(["medications", "calendar", "today", "notes"]);
    expect(screen.getByRole("status", { name: "Panel layout update" })).toHaveTextContent(
      "Medication tracker moved before Calendar",
    );
  } finally {
    document.elementFromPoint = original;
  }
});
