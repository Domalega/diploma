import { FiMonitor, FiMoon, FiSun } from "react-icons/fi";
import { useId } from "react";
import { useTheme } from "./ThemeProvider";

export default function ThemeSwitcher() {
  const { preference, setTheme } = useTheme();
  const name = useId();
  const options = [
    { value: "system", label: "System", Icon: FiMonitor },
    { value: "light", label: "Light", Icon: FiSun },
    { value: "dark", label: "Dark", Icon: FiMoon },
  ];
  return (
    <fieldset className="theme-switcher">
      <legend className="visually-hidden">Theme</legend>
      <div
        className="theme-slider"
        style={{ "--theme-position": options.findIndex((option) => option.value === preference) }}
      >
        <span className="theme-slider-thumb" aria-hidden="true" />
        {options.map(({ value, label, Icon }) => (
          <label
            className="theme-slider-option"
            key={value}
            title={label === "System" ? "Follow your device theme" : label + " theme"}
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
