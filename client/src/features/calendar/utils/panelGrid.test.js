import { collides } from "react-grid-layout/core";
import { GRID_COLUMNS, panelGrid, movePanel, resizePanel, gridHeight } from "./panelGrid";
import { PANEL_ORDER, normalizePanelPositions } from "./panelLayoutConfig";

function assertSafe(items, columns = GRID_COLUMNS) {
  for (const item of items) {
    expect(item.x).toBeGreaterThanOrEqual(0);
    expect(item.x + item.w).toBeLessThanOrEqual(columns);
    expect(item.y).toBeGreaterThanOrEqual(0);
    expect(gridHeight(item.h)).toBeGreaterThan(0);
    for (const other of items) if (other.i !== item.i) expect(collides(item, other)).toBe(false);
  }
}
function permutations(values) {
  return values.length
    ? values.flatMap((id, index) =>
        permutations(values.filter((_, i) => i !== index)).map((rest) => [id, ...rest]),
      )
    : [[]];
}

test("every panel order stays disjoint with mixed sizes, corrupt old positions and narrow layouts", () => {
  const sizes = {
    calendar: { columns: 8, height: 1000 },
    today: { columns: 3, height: 400 },
    notes: { columns: 4, height: 600 },
    medications: { columns: 6, height: 260 },
  };
  for (const order of permutations(PANEL_ORDER)) {
    for (const columns of [24, 12, 1]) {
      const items = panelGrid(
        order,
        sizes,
        { calendar: { x: 0, y: 0 }, notes: { x: 0, y: 0 }, medications: { x: 0, y: 0 } },
        columns,
      );
      assertSafe(items, columns);
      expect(items.map((item) => item.i).sort()).toEqual([...PANEL_ORDER].sort());
    }
  }
});

test("moving and enlarging tiles repeatedly makes room without mutating the saved layout", () => {
  let items = panelGrid(PANEL_ORDER);
  const initial = JSON.stringify(items);
  const enlarged = resizePanel(items, "medications", { columns: 12, height: 1500 });
  assertSafe(enlarged);
  expect(JSON.stringify(items)).toBe(initial);
  for (let index = 0; index < 80; index++) {
    const id = PANEL_ORDER[index % 4];
    items = movePanel(items, id, index % 24, (index * 7) % 80);
    assertSafe(items);
    items = resizePanel(items, id, {
      columns: 4 + (index % 17) / 2,
      height: 300 + ((index * 23) % 1200),
    });
    assertSafe(items);
  }
});

test("unoccupied horizontal space is reachable, hidden tiles return safely, and positions are bounded", () => {
  const items = panelGrid(["today", "notes"], { today: { columns: 3 }, notes: { columns: 3 } });
  const moved = movePanel(items, "today", 16, 0);
  expect(moved.find((item) => item.i === "today").x).toBe(16);
  assertSafe(moved);
  const positions = Object.fromEntries(moved.map((item) => [item.i, { x: item.x, y: item.y }]));
  assertSafe(panelGrid(PANEL_ORDER, {}, positions));
  expect(
    normalizePanelPositions({
      today: { x: 500, y: -4 },
      notes: { x: NaN, y: 5 },
      unknown: { x: 0, y: 0 },
    }),
  ).toEqual({ today: { x: 23, y: 0 } });
});
