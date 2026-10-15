export const PANEL_ORDER = ["calendar", "today", "notes", "medications"];
export const PANEL_COLUMNS = { calendar: 8, today: 4, notes: 4, medications: 12 };
const MIN_COLUMNS = { calendar: 4, today: 2, notes: 3, medications: 4 };
const MIN_HEIGHT = { calendar: 600, today: 144, notes: 240, medications: 260 };

export function clampPanelSize(id, size) {
  if (!PANEL_ORDER.includes(id) || !size || typeof size !== "object") return {};
  const result = {};
  for (const [key, min, max] of [
    ["columns", MIN_COLUMNS[id], 12],
    ["height", MIN_HEIGHT[id], 1600],
  ]) {
    if (typeof size[key] === "number" && Number.isFinite(size[key]))
      result[key] = Math.min(
        max,
        Math.max(min, key === "columns" ? Math.round(size[key] * 2) / 2 : Math.round(size[key])),
      );
  }
  return result;
}
export function normalizePanelSizes(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const id of PANEL_ORDER) {
    const size = clampPanelSize(id, value[id]);
    if (Object.keys(size).length) result[id] = size;
  }
  return result;
}
export function normalizePanelOrder(value) {
  if (!Array.isArray(value)) return [...PANEL_ORDER];
  return [...new Set([...value.filter((id) => PANEL_ORDER.includes(id)), ...PANEL_ORDER])];
}
export function normalizePanelPositions(value) {
  const positions = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return positions;
  for (const id of PANEL_ORDER) {
    const point = value[id];
    if (
      point &&
      typeof point.x === "number" &&
      Number.isFinite(point.x) &&
      typeof point.y === "number" &&
      Number.isFinite(point.y)
    )
      positions[id] = {
        x: Math.max(0, Math.min(23, Math.round(point.x))),
        y: Math.max(0, Math.min(500, Math.round(point.y))),
      };
  }
  return positions;
}
