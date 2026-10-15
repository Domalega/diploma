import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { translate } from "./messages";

export const LANGUAGE_KEY = "daymark.language";
export const languagePreference = (value) =>
  ["system", "ru", "en"].includes(value) ? value : "system";
export function systemLanguage(languages = navigator.languages, language = navigator.language) {
  const preferred = Array.isArray(languages) && languages.length ? languages : [language];
  return (
    preferred
      .map((value) => String(value).toLowerCase().split(/[-_]/)[0])
      .find((value) => ["ru", "en"].includes(value)) || "en"
  );
}
function readPreference() {
  try {
    return languagePreference(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return "system";
  }
}
const fallback = {
  preference: "system",
  locale: "en",
  t: (key, values) => translate(key, "en", values),
  setLanguage() {},
};
const LanguageContext = createContext(fallback);
export function LanguageProvider({ children }) {
  const [preference, updatePreference] = useState(readPreference);
  const [system, setSystem] = useState(systemLanguage);
  const locale = preference === "system" ? system : preference;
  const value = useMemo(
    () => ({
      preference,
      locale,
      t: (key, values) => translate(key, locale, values),
      setLanguage(next) {
        const selection = languagePreference(next);
        updatePreference(selection);
        try {
          localStorage.setItem(LANGUAGE_KEY, selection);
        } catch {
          /* Keep the selection usable without storage. */
        }
      },
    }),
    [preference, locale],
  );
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate("Daymark — Personal calendar", locale);
  }, [locale]);
  useEffect(() => {
    const refresh = () => setSystem(systemLanguage());
    const sync = (event) => {
      if (event.key === LANGUAGE_KEY || event.key === null) updatePreference(readPreference());
    };
    window.addEventListener("languagechange", refresh);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("languagechange", refresh);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
