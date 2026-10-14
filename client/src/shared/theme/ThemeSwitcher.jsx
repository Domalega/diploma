import { FiMonitor, FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "./ThemeProvider";

export default function ThemeSwitcher() {
  const { preference, setTheme } = useTheme();
  const Icon = preference === "system" ? FiMonitor : preference === "dark" ? FiMoon : FiSun;
  return (
    <label className="theme-switcher">
      <Icon aria-hidden="true" />
      <span className="visually-hidden">Theme</span>
      <select value={preference} onChange={(event) => setTheme(event.target.value)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
