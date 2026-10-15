import { useEffect, useId, useRef } from "react";
import { FiMaximize2 } from "react-icons/fi";
import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { clampPanelSize, PANEL_COLUMNS } from "../utils/panelLayoutConfig";

export default function PanelResizeHandle({
  id,
  title,
  size,
  onPreview,
  onResize,
  axis = "se",
  widthEnabled = true,
}) {
  const { t } = useLanguage();
  const helpId = useId();
  const pointer = useRef(null);
  const cancelRef = useRef(null);
  const cancel = () => {
    pointer.current = null;
    onPreview(null);
  };
  cancelRef.current = cancel;
  useEffect(() => {
    const escape = (event) => {
      if (event.key === "Escape" && pointer.current) cancelRef.current();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  function dimensions(element) {
    return element.closest(".dashboard-tile").getBoundingClientRect();
  }
  return (
    <>
      <button
        type="button"
        className={"panel-resize-handle panel-resize-" + axis}
        tabIndex={axis === "se" ? 0 : -1}
        aria-label={t(
          axis === "e"
            ? "Resize width of {panel}"
            : axis === "s"
              ? "Resize height of {panel}"
              : "Resize {panel} panel",
          { panel: title },
        )}
        aria-describedby={helpId}
        title={t("Resize {panel} panel", { panel: title })}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          const grid = event.currentTarget.closest(".dashboard-grid");
          pointer.current = {
            x: event.clientX,
            y: event.clientY,
            rect: dimensions(event.currentTarget),
            gridWidth: grid.getBoundingClientRect().width,
            gap: parseFloat(window.getComputedStyle(grid).columnGap) || 16,
            columns: size?.columns || PANEL_COLUMNS[id],
            horizontal: widthEnabled && axis !== "s",
            next: null,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = pointer.current;
          if (
            !start ||
            (!start.next && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5)
          )
            return;
          start.next = clampPanelSize(id, {
            columns: start.horizontal
              ? ((start.rect.width + event.clientX - start.x + start.gap) /
                  (start.gridWidth + start.gap)) *
                12
              : start.columns,
            height:
              axis === "e"
                ? start.rect.height
                : Math.round((start.rect.height + event.clientY - start.y) / 20) * 20,
          });
          onPreview(start.next);
        }}
        onPointerUp={() => {
          if (pointer.current?.next) onResize(pointer.current.next);
          cancel();
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          const horizontal = ["ArrowLeft", "ArrowRight"].includes(event.key);
          if ((horizontal && (!widthEnabled || axis === "s")) || (!horizontal && axis === "e"))
            return;
          const rect = dimensions(event.currentTarget);
          onResize(
            clampPanelSize(id, {
              columns:
                (size?.columns || PANEL_COLUMNS[id]) +
                (horizontal ? (event.key === "ArrowLeft" ? -0.5 : 0.5) : 0),
              height:
                (size?.height || rect.height) +
                (!horizontal ? (event.key === "ArrowUp" ? -40 : 40) : 0),
            }),
          );
        }}
      >
        <FiMaximize2 aria-hidden="true" />
      </button>
      <span id={helpId} className="visually-hidden">
        {t(
          "Drag this corner to resize. Arrow keys change width and height. Escape cancels. On small screens only height changes.",
        )}
      </span>
    </>
  );
}
