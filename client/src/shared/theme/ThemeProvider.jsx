import { createContext, useContext, useLayoutEffect, useEffect, useMemo, useState } from "react";

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
  const [mediaQuery] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)"));
  const [systemDark, setSystemDark] = useState(() => mediaQuery?.matches || false);
  const resolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolvedTheme;
    document
      .querySelector("#daymark-icon")
      ?.setAttribute("href", process.env.PUBLIC_URL + "/daymark-" + resolvedTheme + ".svg");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolvedTheme === "dark" ? "#101a17" : "#fcfcf9");
  }, [preference, resolvedTheme]);

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
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
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
    [preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used within ThemeProvider");
  return theme;
}
