import { useEffect, useRef, useState } from "react";

// Observe allocated space, not table content: transposing must not resize its own trigger.
export default function useMatrixOrientation(enabled, standalone, expanded) {
  const ref = useRef(null);
  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const target = standalone ? element.closest(".dashboard-tile-body") || element : element;
    function measure() {
      const { width, height } = target.getBoundingClientRect();
      setVertical((previous) => {
        if (!width || !height || (expanded && !standalone)) return false;
        return previous ? width < 680 && height > width : width < 620 && height > width * 1.15;
      });
    }
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(target);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, standalone, expanded]);
  return [ref, vertical];
}
