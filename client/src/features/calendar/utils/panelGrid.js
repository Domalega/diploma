import { collides, moveElement, verticalCompactor } from "react-grid-layout/core";
import { clampPanelSize, PANEL_COLUMNS } from "./panelLayoutConfig";

export const GRID_COLUMNS = 24;
export const GRID_GAP = 16;
export const GRID_ROW_HEIGHT = 4;
export const DEFAULT_HEIGHT = {
  calendar: 884,
  today: 164,
  notes: 424,
  medications: 524,
  kanban: 644,
};
export const gridRows = (height) => Math.ceil((height + GRID_GAP) / (GRID_ROW_HEIGHT + GRID_GAP));
export const gridHeight = (rows) => rows * (GRID_ROW_HEIGHT + GRID_GAP) - GRID_GAP;
const copy = (items) => items.map((item) => ({ ...item }));

function nextSpace(items, item, columns) {
  let best = { x: 0, y: Infinity };
  for (let x = 0; x <= columns - item.w; x++) {
    let y = 0;
    let collision;
    do {
      const candidate = { ...item, x, y };
      collision = items.find((other) => collides(other, candidate));
      if (collision) y = collision.y + collision.h;
    } while (collision);
    if (y < best.y) best = { x, y };
  }
  return best;
}

export function panelGrid(ids, sizes = {}, positions = {}, columns = GRID_COLUMNS) {
  const items = [];
  for (const id of ids) {
    const size = clampPanelSize(id, sizes[id]);
    const w =
      columns === GRID_COLUMNS
        ? Math.round((size.columns || PANEL_COLUMNS[id]) * 2)
        : columns === 1 || ["calendar", "medications", "kanban"].includes(id)
          ? columns
          : columns / 2;
    const item = { i: id, x: 0, y: 0, w, h: gridRows(size.height || DEFAULT_HEIGHT[id]) };
    const position = columns === GRID_COLUMNS ? positions[id] : null;
    Object.assign(
      item,
      position
        ? { x: Math.max(0, Math.min(columns - w, position.x)), y: position.y }
        : nextSpace(items, item, columns),
    );
    items.push(item);
  }
  return verticalCompactor.compact(items, columns);
}

export function movePanel(items, id, x, y, columns = GRID_COLUMNS) {
  const next = copy(items);
  const item = next.find((entry) => entry.i === id);
  if (!item) return next;
  const moved = moveElement(
    next,
    item,
    Math.max(0, Math.min(columns - item.w, Math.round(x))),
    Math.max(0, Math.round(y)),
    true,
    false,
    "vertical",
    columns,
    false,
  );
  return verticalCompactor.compact(moved, columns);
}

export function resizePanel(items, id, size, columns = GRID_COLUMNS) {
  const next = copy(items);
  const item = next.find((entry) => entry.i === id);
  if (!item) return next;
  const bounded = clampPanelSize(id, size);
  item.w = columns === GRID_COLUMNS ? Math.round(bounded.columns * 2) : item.w;
  item.h = gridRows(bounded.height);
  item.x = Math.min(item.x, columns - item.w);
  // Pin the resized tile while the engine moves colliding neighbours out of its area.
  item.static = true;
  return verticalCompactor.compact(next, columns).map(({ static: pinned, ...entry }) => entry);
}
