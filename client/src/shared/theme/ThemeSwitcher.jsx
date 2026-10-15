import { useLanguage } from "../i18n/LanguageProvider";
import { FiMonitor, FiMoon, FiSun } from "react-icons/fi";
import { useId } from "react";
import { useTheme } from "./ThemeProvider";

export default function ThemeSwitcher() {
  const { t } = useLanguage();

  const { preference, setTheme } = useTheme();
  const name = useId();
  const options = [
    { value: "system", label: t("System"), Icon: FiMonitor },
    { value: "light", label: t("Light"), Icon: FiSun },
    { value: "dark", label: t("Dark"), Icon: FiMoon },
  ];
  return (
    <fieldset className="theme-switcher">
      <legend className="visually-hidden">{t("Theme")}</legend>
      <div
        className="theme-slider"
        style={{ "--theme-position": options.findIndex((option) => option.value === preference) }}
      >
        <span className="theme-slider-thumb" aria-hidden="true" />
        {options.map(({ value, label, Icon }) => (
          <label
            className="theme-slider-option"
            key={value}
            title={
              value === "system"
                ? t("Follow your device theme")
                : value === "light"
                  ? t("Light theme")
                  : t("Dark theme")
            }
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={preference === value}
              onChange={() => setTheme(value)}
            />
            <span className="theme-option-content">
              <Icon aria-hidden="true" />
              <span className="theme-option-label">{label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
