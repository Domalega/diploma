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
        className="language-slider"
        style={{
          "--language-position": options.findIndex((option) => option.value === preference),
        }}
      >
        <span className="language-slider-thumb" aria-hidden="true" />
        {options.map(({ value, label }) => (
          <label key={value}>
            <input
              type="radio"
              name={name}
              value={value}
              checked={preference === value}
              onChange={() => setLanguage(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
