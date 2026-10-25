import { useId } from "react";
import { FiCheck } from "react-icons/fi";
import { useLanguage } from "../i18n/LanguageProvider";
import { useTheme } from "./ThemeProvider";
import { COLOR_PALETTES } from "./palettes";

export default function ColorSwitcher() {
  const { t } = useLanguage();
  const { color, setColor } = useTheme();
  const name = useId();
  return (
    <fieldset className="color-switcher">
      <legend>{t("Color palette")}</legend>
      <div className="color-options">
        {COLOR_PALETTES.map(({ value, label, swatch }) => (
          <label className="color-option" key={value}>
            <input
              type="radio"
              name={name}
              value={value}
              checked={color === value}
              onChange={() => setColor(value)}
            />
            <span className="color-option-content">
              <span className="color-swatch" style={{ "--swatch": swatch }} aria-hidden="true">
                {color === value && <FiCheck />}
              </span>
              <span>{t(label)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
