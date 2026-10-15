import { useEffect, useRef, useState } from "react";
import { FiPlus } from "react-icons/fi";

export default function MatrixAddControl({ axis, label, disabled, onAdd }) {
  const [revealed, setRevealed] = useState(false);
  const timer = useRef(null);
  const trigger = useRef(null);
  const cancel = () => window.clearTimeout(timer.current);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (disabled) {
      window.clearTimeout(timer.current);
      setRevealed(false);
    }
  }, [disabled]);
  useEffect(() => {
    if (!revealed) return;
    const dismiss = (event) => {
      if (!trigger.current?.contains(event.target)) setRevealed(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [revealed]);
  return (
    <button
      type="button"
      ref={trigger}
      className={"matrix-add-control matrix-add-" + axis + (revealed ? " is-revealed" : "")}
      aria-label={label}
      disabled={disabled}
      onPointerEnter={(event) => {
        cancel();
        if (event.pointerType !== "touch" && !disabled)
          timer.current = window.setTimeout(() => setRevealed(true), 650);
      }}
      onPointerLeave={(event) => {
        cancel();
        if (event.pointerType === "touch") return;
        if (!event.currentTarget.matches(":focus-visible")) setRevealed(false);
      }}
      onPointerCancel={() => {
        cancel();
        setRevealed(false);
      }}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) {
          cancel();
          setRevealed(true);
        }
      }}
      onBlur={() => {
        cancel();
        setRevealed(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          cancel();
          setRevealed(false);
        }
      }}
      onClick={(event) => {
        cancel();
        // A first tap reveals the edge action; keyboard activation works immediately.
        if (!revealed && event.detail !== 0) {
          setRevealed(true);
          return;
        }
        setRevealed(false);
        onAdd();
      }}
    >
      <span className="matrix-add-affordance" aria-hidden="true">
        <FiPlus />
      </span>
      <span className="matrix-add-caption" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
