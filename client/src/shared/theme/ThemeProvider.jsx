import { createContext, useContext, useLayoutEffect, useEffect, useMemo, useState } from "react";
import brand from "../brand";
import { COLOR_STORAGE_KEY, readColor, validColor } from "./palettes";

export const THEME_STORAGE_KEY = "calendar.theme";
const ThemeContext = createContext(null);
const preferenceOrSystem = (value) =>
  ["light", "dark", "system"].includes(value) ? value : "system";

function readPreference() {
  try {
    return preferenceOrSystem(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPreference);
  const [color, setColorPreference] = useState(readColor);
  const [mediaQuery] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)"));
  const [systemDark, setSystemDark] = useState(() => mediaQuery?.matches || false);
  const resolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = preference;
    root.dataset.color = color;
    root.style.colorScheme = resolvedTheme;
    let icon = process.env.PUBLIC_URL + "/daymark-" + resolvedTheme + ".svg";
    const styles = getComputedStyle(root);
    const brandBackground = styles.getPropertyValue("--brand-bg").trim();
    if (color !== "green" && brandBackground) {
      const outline = styles.getPropertyValue("--brand-outline").trim();
      const jot = styles.getPropertyValue("--brand-check").trim();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="${brandBackground}"/><g fill="none" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="${brand.stridePath}" stroke="${outline}"/><path d="${brand.jotPath}" stroke="${jot}"/></g></svg>`;
      icon = "data:image/svg+xml," + encodeURIComponent(svg);
    }
    document.querySelector("#daymark-icon")?.setAttribute("href", icon);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        getComputedStyle(document.body).backgroundColor ||
          (resolvedTheme === "dark" ? "#181d10" : "#f6f8eb"),
      );
    window.DaymarkAppearance?.postMessage(JSON.stringify({ theme: resolvedTheme }));
  }, [preference, resolvedTheme, color]);

  useEffect(() => {
    if (!mediaQuery) return;
    const onChange = (event) => setSystemDark(event.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    }
    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, [mediaQuery]);

  useEffect(() => {
    const onStorage = (event) => {
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        return;
      }
      if (event.key === THEME_STORAGE_KEY || event.key === null)
        setPreference(preferenceOrSystem(event.newValue));
      if (event.key === COLOR_STORAGE_KEY || event.key === null)
        setColorPreference(validColor(event.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      color,
      setColor(next) {
        const selection = validColor(next);
        setColorPreference(selection);
        try {
          localStorage.setItem(COLOR_STORAGE_KEY, selection);
        } catch {
          /* Keep color selection usable when browser storage is restricted. */
        }
      },
      setTheme(next) {
        const selection = preferenceOrSystem(next);
        setPreference(selection);
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, selection);
        } catch {
          /* Keep the theme usable when browser storage is restricted. */
        }
      },
    }),
    [preference, resolvedTheme, color],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used within ThemeProvider");
  return theme;
}
