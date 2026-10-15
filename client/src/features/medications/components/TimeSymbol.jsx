import { FiMoon, FiSun, FiSunrise, FiSunset } from "react-icons/fi";
export default function TimeSymbol({ time }) {
  const hour = +time.slice(0, 2);
  const Icon =
    hour >= 5 && hour < 11
      ? FiSunrise
      : hour >= 11 && hour < 17
        ? FiSun
        : hour >= 17 && hour < 22
          ? FiSunset
          : FiMoon;
  return <Icon aria-hidden="true" />;
}
