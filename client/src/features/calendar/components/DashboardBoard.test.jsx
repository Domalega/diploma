import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import DashboardBoard from "./DashboardBoard";
import {
  normalizePanelOrder,
  normalizePanelSizes,
  PANEL_LAYOUT_KEY,
  PANEL_SIZES_KEY,
  COMPACT_DATE_KEY,
  PANEL_POSITIONS_KEY,
  PANEL_ORDER,
} from "../hooks/usePanelLayout";

const panels = {
  calendar: { title: "Calendar", content: <p>Month view</p> },
  today: { title: "Today", content: <p>Current date</p> },
  notes: {
    title: "Notes",
    content: <input aria-label="Unsaved test draft" defaultValue="Keep me" />,
  },
  medications: { title: "Medication tracker", content: <p>Intake table</p> },
};
const visiblePanelOrder = PANEL_ORDER.filter((id) => panels[id]);
const visibleOrder = () =>
  within(screen.getByRole("group", { name: "Calendar panels" }))
    .getAllByRole("region")
    .map((element) => element.getAttribute("data-panel-id"));
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(COMPACT_DATE_KEY, "true");
});

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
  const savedOrder = visibleOrder();
  expect(JSON.parse(localStorage.getItem(PANEL_POSITIONS_KEY))).toHaveProperty("medications");
  expect(screen.getByLabelText("Unsaved test draft")).toHaveValue("Still editing");
  expect(JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY)).filter((id) => panels[id])).toEqual(
    visibleOrder(),
  );
  expect(screen.getByRole("button", { name: "Drag Medication tracker panel" })).toHaveFocus();
  view.unmount();
  view = render(<DashboardBoard panels={panels} />);
  expect(visibleOrder()).toEqual(savedOrder);
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));
  expect(visibleOrder()).toEqual(visiblePanelOrder);
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
    expect(visibleOrder()).toEqual(visiblePanelOrder);
    fireEvent.keyDown(window, { key: "Escape" });
    pointerEvent(handle, "pointerUp", { clientX: 130 });
    expect(localStorage.getItem(PANEL_LAYOUT_KEY)).toBeNull();
    pointerEvent(handle, "pointerDown");
    pointerEvent(handle, "pointerMove", { clientX: 130 });
    pointerEvent(handle, "pointerUp", { clientX: 130 });
    expect(visibleOrder()).toEqual(["medications", "calendar", "today", "notes"]);
    expect(screen.getByRole("status", { name: "Panel layout update" })).toHaveTextContent(
      "Medication tracker position saved.",
    );
  } finally {
    document.elementFromPoint = original;
  }
});

test("keyboard resizing persists sizes, preserves drafts, and reset restores order and dimensions", () => {
  let view = render(<DashboardBoard panels={panels} />);
  expect(screen.queryByRole("button", { name: "Resize Notes panel" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Unsaved test draft"), {
    target: { value: "Keep this draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  const handle = screen.getByRole("button", { name: "Resize Notes panel" });
  jest
    .spyOn(screen.getByRole("region", { name: "Notes", exact: true }), "getBoundingClientRect")
    .mockReturnValue({ height: 400 });
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  expect(JSON.parse(localStorage.getItem(PANEL_SIZES_KEY)).notes).toEqual({
    columns: 4.5,
    height: 464,
  });
  expect(screen.getByLabelText("Unsaved test draft")).toHaveValue("Keep this draft");
  fireEvent.click(screen.getByRole("button", { name: "Done arranging" }));
  expect(screen.getByRole("region", { name: "Notes", exact: true })).toHaveStyle({
    "--panel-columns": "4.5",
    "--panel-height": "464px",
  });
  view.unmount();
  view = render(<DashboardBoard panels={panels} />);
  expect(screen.getByRole("region", { name: "Notes", exact: true })).toHaveStyle({
    "--panel-height": "464px",
  });
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));
  expect(visibleOrder()).toEqual(visiblePanelOrder);
  expect(JSON.parse(localStorage.getItem(PANEL_SIZES_KEY))).toEqual({});
  expect(screen.getByRole("region", { name: "Notes", exact: true })).toHaveStyle({
    height: "424px",
  });
});

test("corner dragging previews without saving, Escape/cancel discard, and release commits", () => {
  render(<DashboardBoard panels={panels} />);
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  jest
    .spyOn(screen.getByRole("group", { name: "Calendar panels" }), "getBoundingClientRect")
    .mockReturnValue({ width: 1200 });
  const tile = screen.getByRole("region", { name: "Today", exact: true });
  jest.spyOn(tile, "getBoundingClientRect").mockReturnValue({ width: 400, height: 166 });
  const handle = screen.getByRole("button", { name: "Resize Today panel" });
  pointerEvent(handle, "pointerDown");
  pointerEvent(handle, "pointerMove", { clientX: 300, clientY: 200 });
  expect(tile).toHaveClass("is-resizing");
  expect(localStorage.getItem(PANEL_SIZES_KEY)).toBeNull();
  fireEvent.keyDown(window, { key: "Escape" });
  pointerEvent(handle, "pointerUp");
  expect(tile).toHaveStyle({ height: "164px" });
  expect(localStorage.getItem(PANEL_SIZES_KEY)).toBeNull();
  pointerEvent(handle, "pointerDown");
  pointerEvent(handle, "pointerMove", { clientX: 300, clientY: 200 });
  pointerEvent(handle, "pointerCancel");
  expect(localStorage.getItem(PANEL_SIZES_KEY)).toBeNull();
  pointerEvent(handle, "pointerDown");
  pointerEvent(handle, "pointerMove", { clientX: 300, clientY: 200 });
  pointerEvent(handle, "pointerUp");
  expect(JSON.parse(localStorage.getItem(PANEL_SIZES_KEY)).today).toEqual({
    columns: 6,
    height: 264,
  });
});

test("small screens change height without overwriting the saved desktop width", () => {
  const width = window.innerWidth;
  window.innerWidth = 480;
  localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify({ today: { columns: 5, height: 300 } }));
  try {
    render(<DashboardBoard panels={panels} />);
    fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
    const handle = screen.getByRole("button", { name: "Resize Today panel" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(JSON.parse(localStorage.getItem(PANEL_SIZES_KEY)).today).toEqual({
      columns: 5,
      height: 344,
    });
  } finally {
    window.innerWidth = width;
  }
});

test("side and bottom handles change only their own dimension", () => {
  render(<DashboardBoard panels={panels} />);
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  jest
    .spyOn(screen.getByRole("group", { name: "Calendar panels" }), "getBoundingClientRect")
    .mockReturnValue({ width: 1200 });
  const tile = screen.getByRole("region", { name: "Today", exact: true });
  jest.spyOn(tile, "getBoundingClientRect").mockReturnValue({ width: 400, height: 164 });
  const side = screen.getByRole("button", { name: "Resize width of Today" });
  pointerEvent(side, "pointerDown");
  pointerEvent(side, "pointerMove", { clientX: 200, clientY: 400 });
  pointerEvent(side, "pointerUp");
  expect(JSON.parse(localStorage.getItem(PANEL_SIZES_KEY)).today).toEqual({
    columns: 5,
    height: 164,
  });
  const bottom = screen.getByRole("button", { name: "Resize height of Today" });
  pointerEvent(bottom, "pointerDown");
  pointerEvent(bottom, "pointerMove", { clientX: 500, clientY: 180 });
  pointerEvent(bottom, "pointerUp");
  expect(JSON.parse(localStorage.getItem(PANEL_SIZES_KEY)).today).toEqual({
    columns: 5,
    height: 244,
  });
});

test("saved dimensions are bounded, unknown panels are ignored, and hidden tiles keep their sizes", () => {
  expect(
    normalizePanelSizes({
      today: { columns: -9, height: 9000 },
      calendar: { columns: 99, height: 1 },
      notes: { columns: true, height: "400" },
      unknown: { columns: 4 },
    }),
  ).toEqual({ today: { columns: 2, height: 1600 }, calendar: { columns: 12, height: 600 } });
  expect(normalizePanelSizes([])).toEqual({});
  localStorage.setItem(
    PANEL_SIZES_KEY,
    JSON.stringify({ medications: { columns: 6, height: 460 } }),
  );
  const view = render(<DashboardBoard panels={{ ...panels, medications: null }} />);
  view.rerender(<DashboardBoard panels={panels} />);
  expect(screen.getByRole("region", { name: "Medication tracker", exact: true })).toHaveStyle({
    "--panel-height": "464px",
  });
});

test("existing date tiles become compact once, preserving later manual sizes", () => {
  localStorage.removeItem(COMPACT_DATE_KEY);
  localStorage.setItem(
    PANEL_SIZES_KEY,
    JSON.stringify({ today: { columns: 3, height: 500 }, notes: { height: 460 } }),
  );
  const view = render(<DashboardBoard panels={panels} />);
  expect(screen.getByRole("region", { name: "Today", exact: true })).toHaveStyle({
    height: "164px",
  });
  expect(JSON.parse(localStorage.getItem(PANEL_SIZES_KEY))).toEqual({
    today: { columns: 3, height: 164 },
    notes: { height: 460 },
  });
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Resize Today panel" }), {
    key: "ArrowDown",
  });
  view.unmount();
  render(<DashboardBoard panels={panels} />);
  expect(screen.getByRole("region", { name: "Today", exact: true })).toHaveStyle({
    height: "204px",
  });
});
