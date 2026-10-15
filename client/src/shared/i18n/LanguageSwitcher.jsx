import { useId } from "react";
import { FiGlobe } from "react-icons/fi";
import { useLanguage } from "./LanguageProvider";
import "./LanguageSwitcher.css";

export default function LanguageSwitcher() {
  const { preference, setLanguage, t } = useLanguage();
  const name = useId();
  const options = [
    { value: "system", label: t("System language") },
    { value: "ru", label: "Русский" },
    { value: "en", label: "English" },
  ];
  return (
    <fieldset className="language-switcher">
      <legend>
        <FiGlobe aria-hidden="true" /> {t("Language")}
      </legend>
      <div
        className="theme-slider language-slider"
        style={{
          "--theme-position": options.findIndex((option) => option.value === preference),
        }}
      >
        <span className="theme-slider-thumb" aria-hidden="true" />
        {options.map(({ value, label }) => (
          <label className="theme-slider-option" key={value} title={label}>
            <input
              type="radio"
              aria-label={label}
              name={name}
              value={value}
              checked={preference === value}
              onChange={() => setLanguage(value)}
            />
            <span className="theme-option-content" aria-hidden="true">
              {value === "system" ? (
                <FiGlobe />
              ) : (
                <span className="language-symbol">{value === "ru" ? "РУ" : "EN"}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
