import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useEffect, useRef, useState } from "react";
import { FiArrowDown, FiArrowUp, FiGrid, FiMove, FiRotateCcw, FiCheck } from "react-icons/fi";
import usePanelLayout from "../hooks/usePanelLayout";
import PanelResizeHandle from "./PanelResizeHandle";
import "../styles/Dashboard.css";

export default function DashboardBoard({ panels, heading, primaryAction }) {
  const { t } = useLanguage();

  const layout = usePanelLayout();
  const [arranging, setArranging] = useState(false);
  const [drag, setDrag] = useState(null);
  const [message, setMessage] = useState("");
  const [resizing, setResizing] = useState(null);
  const pointer = useRef(null);
  const handles = useRef({});
  const visible = layout.order.filter((id) => panels[id]);
  const calendarIndex = visible.indexOf("calendar");
  const panelSize = (id) => (resizing?.id === id ? resizing : layout.sizes[id]);
  const calendarColumns = panelSize("calendar")?.columns || 8;
  const todayColumns = panelSize("today")?.columns || 4;
  const notesColumns = panelSize("notes")?.columns || 4;
  const compatibleWidths =
    calendarColumns + Math.max(todayColumns, notesColumns) <= 12 &&
    calendarColumns + todayColumns + notesColumns > 12;
  const compactGroup =
    compatibleWidths &&
    visible.some((_, index) => {
      const group = visible.slice(index, index + 3);
      return (
        group.length === 3 &&
        group.every((id) => ["calendar", "today", "notes"].includes(id)) &&
        calendarIndex !== index + 2
      );
    });
  function cancelDrag() {
    pointer.current = null;
    setDrag(null);
  }
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
      const offset = drag.y < 64 ? -14 : drag.y > window.innerHeight - 64 ? 14 : 0;
      if (!offset || !pointer.current) return;
      window.scrollBy(0, offset);
      const hit = document.elementFromPoint(drag.x, drag.y)?.closest("[data-panel-id]");
      const target = hit?.dataset.panelId || null;
      pointer.current.target = target;
      if (target !== drag.target) setDrag((current) => (current ? { ...current, target } : null));
    }, 30);
    return () => window.clearInterval(timer);
  }, [drag]);
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
  function step(id, offset) {
    move(id, visible[visible.indexOf(id) + offset]);
  }
  function pointerDown(event, id) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointer.current = { id, x: event.clientX, y: event.clientY, target: id, active: false };
  }
  function pointerMove(event) {
    const current = pointer.current;
    if (!current) return;
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6)
      return;
    current.active = true;
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-panel-id]");
    current.target = hit?.dataset.panelId || null;
    setDrag({ id: current.id, target: current.target, x: event.clientX, y: event.clientY });
  }
  function pointerUp(event) {
    const current = pointer.current;
    if (current?.active) {
      event.preventDefault();
      move(current.id, current.target);
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
        className={
          "dashboard-grid" +
          (arranging ? " is-arranging" : "") +
          (compactGroup ? " has-stacked-calendar" : "")
        }
        style={
          compactGroup
            ? {
                "--dashboard-rows": visible
                  .filter((id) => id !== "calendar")
                  .map((id) =>
                    panelSize(id)?.height
                      ? panelSize(id).height + "px"
                      : id === "today"
                        ? "286px"
                        : "auto",
                  )
                  .join(" "),
              }
            : undefined
        }
        role="group"
        aria-label={t("Calendar panels")}
      >
        {visible.map((id, index) => {
          const panel = panels[id];
          const size = resizing?.id === id ? resizing : layout.sizes[id];
          return (
            <section
              key={id}
              data-panel-id={id}
              className={
                "dashboard-tile tile-" +
                id +
                (size?.columns ? " has-custom-width" : "") +
                (size?.height ? " has-custom-height" : "") +
                (resizing?.id === id ? " is-resizing" : "") +
                (drag?.id === id ? " is-dragging" : "") +
                (drag?.target === id && drag.id !== id ? " is-drop-target" : "")
              }
              aria-labelledby={"panel-" + id + "-title"}
              style={{
                "--panel-columns": size?.columns,
                "--panel-height": size?.height ? size.height + "px" : undefined,
              }}
            >
              <header className="dashboard-tile-header">
                <div className="dashboard-tile-label">
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
                        onClick={() => step(id, -1)}
                      >
                        <FiArrowUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("Move {panel} later", { panel: panel.title })}
                        disabled={index === visible.length - 1}
                        onClick={() => step(id, 1)}
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
                            ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)
                          ) {
                            event.preventDefault();
                            step(id, ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1);
                          }
                        }}
                      >
                        <FiMove aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </header>
              <div className="dashboard-tile-body">{panel.content}</div>
              {arranging && (
                <PanelResizeHandle
                  id={id}
                  title={panel.title}
                  size={layout.sizes[id]}
                  onPreview={(next) => setResizing(next ? { id, ...next } : null)}
                  onResize={(next) => {
                    layout.resize(id, next);
                    setMessage(
                      t("{panel} resized to {columns}/12 width and {height}px height.", {
                        panel: panel.title,
                        ...next,
                      }),
                    );
                  }}
                />
              )}
              {resizing?.id === id && (
                <output className="panel-size-preview" aria-hidden="true">
                  {size.columns}/12 · {size.height}px
                </output>
              )}
            </section>
          );
        })}
      </div>
      <span id="panel-reorder-help" className="visually-hidden">
        {t(
          "Drag to another panel to move it. Use arrow keys to move earlier or later. Escape cancels a drag.",
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
          <FiMove /> {panels[drag.id]?.title}
        </div>
      )}
    </div>
  );
}
