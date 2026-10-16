import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FiArrowDown, FiArrowUp, FiGrid, FiMove, FiRotateCcw, FiCheck } from "react-icons/fi";
import usePanelLayout from "../hooks/usePanelLayout";
import PanelResizeHandle from "./PanelResizeHandle";
import {
  GRID_COLUMNS,
  GRID_GAP,
  GRID_ROW_HEIGHT,
  gridHeight,
  panelGrid,
  movePanel,
  resizePanel,
} from "../utils/panelGrid";
import "../styles/Dashboard.css";

export default function DashboardBoard({ panels, heading, primaryAction, hideHeaders = false }) {
  const { t } = useLanguage();
  const layout = usePanelLayout();
  const [arranging, setArranging] = useState(false);
  const [drag, setDrag] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [message, setMessage] = useState("");
  const gridRef = useRef(null);
  const pointer = useRef(null);
  const handles = useRef({});
  const [width, setWidth] = useState(() => Math.max(280, window.innerWidth - 64));
  const columns = width >= 900 ? GRID_COLUMNS : width >= 600 ? 12 : 1;
  const visible = useMemo(() => layout.order.filter((id) => panels[id]), [layout.order, panels]);
  const baseGrid = useMemo(
    () => panelGrid(visible, layout.sizes, layout.positions, columns),
    [visible, layout.sizes, layout.positions, columns],
  );
  const displayedGrid =
    drag?.grid || (resizing ? resizePanel(baseGrid, resizing.id, resizing, columns) : baseGrid);
  const columnStep = (width + GRID_GAP) / columns;
  const rowStep = GRID_ROW_HEIGHT + GRID_GAP;
  function box(item) {
    return {
      left: item.x * columnStep,
      top: item.y * rowStep,
      width: item.w * columnStep - GRID_GAP,
      height: gridHeight(item.h),
    };
  }
  function cancelDrag() {
    pointer.current = null;
    setDrag(null);
  }
  useLayoutEffect(() => {
    const measure = () => {
      const next = gridRef.current?.getBoundingClientRect().width;
      if (next > 0) setWidth(next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (gridRef.current) observer?.observe(gridRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    pointer.current = null;
    setDrag(null);
    setResizing(null);
  }, [columns]);
  useEffect(() => {
    const cancel = (event) => {
      if (event.key === "Escape") {
        pointer.current = null;
        setDrag(null);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  useEffect(() => {
    if (!drag) return;
    const timer = window.setInterval(() => {
      const current = pointer.current;
      const offset = drag.y < 64 ? -14 : drag.y > window.innerHeight - 64 ? 14 : 0;
      if (!offset || !current) return;
      window.scrollBy(0, offset);
      updateDrag(drag.x, drag.y);
    }, 30);
    return () => window.clearInterval(timer);
    // The pointer snapshot owns the active gesture; render updates only refresh its preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);
  function savePlacement(next, resizedId = null, reordered = false) {
    const positions = { ...layout.positions };
    if (columns === GRID_COLUMNS)
      next.forEach((item) => {
        positions[item.i] = { x: item.x, y: item.y };
      });
    const item = resizedId && next.find((entry) => entry.i === resizedId);
    const sizes = item
      ? {
          ...layout.sizes,
          [resizedId]: {
            columns: columns === GRID_COLUMNS ? item.w / 2 : layout.sizes[resizedId]?.columns,
            height: gridHeight(item.h),
          },
        }
      : null;
    let order;
    if (reordered) {
      const sorted = [...next].sort((a, b) => a.y - b.y || a.x - b.x).map((entry) => entry.i);
      order = layout.order.map((id) => (panels[id] ? sorted.shift() : id));
    }
    layout.arrange(columns !== GRID_COLUMNS && reordered ? {} : positions, sizes, order);
  }
  function move(id, target) {
    if (!target || target === id || !visible.includes(target)) return;
    layout.move(id, target);
    setMessage(
      t(
        visible.indexOf(id) < visible.indexOf(target)
          ? "{panel} moved after {target}."
          : "{panel} moved before {target}.",
        { panel: panels[id].title, target: panels[target].title },
      ),
    );
    handles.current[id]?.focus({ preventScroll: true });
  }
  function updateDrag(x, y) {
    const current = pointer.current;
    if (!current) return;
    const rect = gridRef.current.getBoundingClientRect();
    current.preview = movePanel(
      current.grid,
      current.id,
      (x - rect.left - current.offsetX) / columnStep,
      (y - rect.top - current.offsetY) / rowStep,
      columns,
    );
    setDrag({ id: current.id, x, y, grid: current.preview });
  }
  function pointerDown(event, id) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const rect = event.currentTarget.closest(".dashboard-tile").getBoundingClientRect();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointer.current = {
      id,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      grid: baseGrid,
      active: false,
    };
  }
  function pointerMove(event) {
    const current = pointer.current;
    if (
      !current ||
      (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6)
    )
      return;
    current.active = true;
    updateDrag(event.clientX, event.clientY);
  }
  function pointerUp(event) {
    const current = pointer.current;
    if (current?.active && current.preview) {
      event.preventDefault();
      savePlacement(current.preview, null, true);
      setMessage(t("{panel} position saved.", { panel: panels[current.id].title }));
    }
    cancelDrag();
  }
  return (
    <div className="dashboard-board">
      <div className="dashboard-layout-toolbar">
        <div className="dashboard-layout-heading">{heading}</div>
        <div className="dashboard-layout-controls">
          {arranging && (
            <button
              type="button"
              className="dashboard-layout-button"
              onClick={() => {
                layout.reset();
                setResizing(null);
                cancelDrag();
                setMessage("Default panel layout restored.");
              }}
            >
              <FiRotateCcw aria-hidden="true" />
              {" " + t("Reset layout")}
            </button>
          )}
          <button
            type="button"
            className="dashboard-layout-button"
            aria-pressed={arranging}
            onClick={() => {
              cancelDrag();
              setResizing(null);
              setArranging(!arranging);
            }}
          >
            {arranging ? <FiCheck aria-hidden="true" /> : <FiGrid aria-hidden="true" />}
            {arranging ? t("Done arranging") : t("Arrange panels")}
          </button>
          {primaryAction}
        </div>
      </div>
      <div
        ref={gridRef}
        className={"dashboard-grid" + (arranging ? " is-arranging" : "")}
        style={{
          height: Math.max(
            0,
            ...displayedGrid.map((item) => (item.y + item.h) * rowStep - GRID_GAP),
          ),
        }}
        role="group"
        aria-label={t("Calendar panels")}
      >
        {visible.map((id, index) => {
          const panel = panels[id];
          const item = displayedGrid.find((entry) => entry.i === id);
          const bounds = box(item);
          const size = {
            columns: columns === GRID_COLUMNS ? item.w / 2 : layout.sizes[id]?.columns,
            height: bounds.height,
          };
          return (
            <section
              key={id}
              data-panel-id={id}
              className={
                "dashboard-tile tile-" +
                id +
                " has-custom-height" +
                (resizing?.id === id ? " is-resizing" : "") +
                (drag?.id === id ? " is-dragging" : "")
              }
              aria-labelledby={"panel-" + id + "-title"}
              style={{
                ...bounds,
                "--panel-columns": size.columns,
                "--panel-height": bounds.height + "px",
              }}
            >
              <header
                className={
                  "dashboard-tile-header" +
                  (hideHeaders && !arranging
                    ? " is-title-hidden" + (panel.actions ? " has-actions" : "")
                    : "")
                }
              >
                <div
                  className={
                    hideHeaders && !arranging
                      ? "dashboard-tile-label visually-hidden"
                      : "dashboard-tile-label"
                  }
                >
                  {panel.icon && (
                    <span className="dashboard-tile-icon" aria-hidden="true">
                      {panel.icon}
                    </span>
                  )}
                  <div>
                    <h2 id={"panel-" + id + "-title"}>{panel.title}</h2>
                    {panel.subtitle && <p>{panel.subtitle}</p>}
                  </div>
                </div>
                <div className="dashboard-tile-actions">
                  {!arranging && panel.actions}
                  {arranging && (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("Move {panel} earlier", { panel: panel.title })}
                        disabled={index === 0}
                        onClick={() => move(id, visible[index - 1])}
                      >
                        <FiArrowUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("Move {panel} later", { panel: panel.title })}
                        disabled={index === visible.length - 1}
                        onClick={() => move(id, visible[index + 1])}
                      >
                        <FiArrowDown aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button panel-drag-handle"
                        aria-label={t("Drag {panel} panel", { panel: panel.title })}
                        aria-describedby="panel-reorder-help"
                        ref={(element) => {
                          handles.current[id] = element;
                        }}
                        onPointerDown={(event) => pointerDown(event, id)}
                        onPointerMove={pointerMove}
                        onPointerUp={pointerUp}
                        onPointerCancel={cancelDrag}
                        onLostPointerCapture={cancelDrag}
                        onKeyDown={(event) => {
                          if (
                            !["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)
                          )
                            return;
                          event.preventDefault();
                          savePlacement(
                            movePanel(
                              baseGrid,
                              id,
                              item.x +
                                (event.key === "ArrowLeft"
                                  ? -1
                                  : event.key === "ArrowRight"
                                    ? 1
                                    : 0),
                              item.y +
                                (event.key === "ArrowUp" ? -4 : event.key === "ArrowDown" ? 4 : 0),
                              columns,
                            ),
                            null,
                            true,
                          );
                          setMessage(t("{panel} position saved.", { panel: panel.title }));
                        }}
                      >
                        <FiMove aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </header>
              {arranging && panel.arrangeActions && (
                <div className="dashboard-tile-options">{panel.arrangeActions}</div>
              )}
              <div className="dashboard-tile-body">{panel.content}</div>
              {arranging &&
                (columns === GRID_COLUMNS ? ["e", "s", "se"] : ["s", "se"]).map((axis) => (
                  <PanelResizeHandle
                    key={axis}
                    axis={axis}
                    id={id}
                    title={panel.title}
                    size={size}
                    widthEnabled={columns === GRID_COLUMNS}
                    onPreview={(next) => setResizing(next ? { id, ...next } : null)}
                    onResize={(next) => {
                      const updated = resizePanel(baseGrid, id, next, columns);
                      savePlacement(updated, id);
                      const changed = updated.find((entry) => entry.i === id);
                      setMessage(
                        t("{panel} resized to {columns}/12 width and {height}px height.", {
                          panel: panel.title,
                          columns:
                            columns === GRID_COLUMNS
                              ? changed.w / 2
                              : layout.sizes[id]?.columns || 12,
                          height: gridHeight(changed.h),
                        }),
                      );
                    }}
                  />
                ))}
              {resizing?.id === id && (
                <output className="panel-size-preview" aria-hidden="true">
                  {columns === GRID_COLUMNS ? item.w / 2 + "/12 · " : ""}
                  {bounds.height}px
                </output>
              )}
            </section>
          );
        })}
      </div>
      <span id="panel-reorder-help" className="visually-hidden">
        {t(
          "Drag into an open space. Arrow keys move across the grid. Escape cancels; neighbouring tiles make room automatically.",
        )}
      </span>
      <span className="visually-hidden" role="status" aria-label={t("Panel layout update")}>
        {t(message)}
      </span>
      {drag && (
        <div
          aria-hidden="true"
          className="panel-drag-preview"
          style={{
            left: Math.max(8, Math.min(drag.x + 14, window.innerWidth - 220)),
            top: Math.max(8, Math.min(drag.y + 14, window.innerHeight - 52)),
          }}
        >
          <FiMove />
          {panels[drag.id]?.title}
        </div>
      )}
    </div>
  );
}
