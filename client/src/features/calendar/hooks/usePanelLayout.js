import { useState } from "react";
import {
  PANEL_ORDER,
  normalizePanelOrder,
  normalizePanelSizes,
  normalizePanelPositions,
} from "../utils/panelLayoutConfig";

export {
  PANEL_ORDER,
  PANEL_COLUMNS,
  clampPanelSize,
  normalizePanelOrder,
  normalizePanelSizes,
} from "../utils/panelLayoutConfig";
export const PANEL_LAYOUT_KEY = "daymark.panel-layout.v1";
export const PANEL_SIZES_KEY = "daymark.panel-sizes.v1";
export const PANEL_POSITIONS_KEY = "daymark.panel-positions.v1";
export const COMPACT_DATE_KEY = "daymark.compact-date.v1";
function readLayout() {
  try {
    return normalizePanelOrder(JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY)));
  } catch {
    return [...PANEL_ORDER];
  }
}
export default function usePanelLayout() {
  const [order, setOrder] = useState(readLayout);
  const [sizes, setSizes] = useState(() => {
    try {
      const saved = normalizePanelSizes(JSON.parse(localStorage.getItem(PANEL_SIZES_KEY)));
      if (!localStorage.getItem(COMPACT_DATE_KEY)) {
        if (saved.today?.height) {
          saved.today.height = 164;
          localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify(saved));
        }
        localStorage.setItem(COMPACT_DATE_KEY, "true");
      }
      return saved;
    } catch {
      return {};
    }
  });
  const [positions, setPositions] = useState(() => {
    try {
      return normalizePanelPositions(JSON.parse(localStorage.getItem(PANEL_POSITIONS_KEY)));
    } catch {
      return {};
    }
  });
  function savePositions(next) {
    setPositions(next);
    try {
      localStorage.setItem(PANEL_POSITIONS_KEY, JSON.stringify(next));
    } catch {
      /* The workspace still works without persistent storage. */
    }
  }
  function saveSizes(next) {
    setSizes(next);
    try {
      localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify(next));
    } catch {
      /* Resizing remains available without browser storage. */
    }
  }
  function save(next) {
    setOrder(next);
    try {
      localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(next));
    } catch {
      /* Layout changes still work when browser storage is unavailable. */
    }
  }
  function move(id, target) {
    if (id === target || !order.includes(id) || !order.includes(target)) return;
    const next = [...order];
    next.splice(order.indexOf(id), 1);
    next.splice(order.indexOf(target), 0, id);
    save(next);
    savePositions({});
  }
  return {
    order,
    sizes,
    positions,
    arrange: (nextPositions, nextSizes, nextOrder) => {
      savePositions(normalizePanelPositions(nextPositions));
      if (nextSizes) saveSizes(normalizePanelSizes(nextSizes));
      if (nextOrder) save(normalizePanelOrder(nextOrder));
    },
    move,
    reset: () => {
      save([...PANEL_ORDER]);
      saveSizes({});
      savePositions({});
    },
  };
}
