export function weekdayLabel(value, locale = "en", width = "short") {
  return new Intl.DateTimeFormat(locale, { weekday: width }).format(
    new Date(2024, 0, value === 0 ? 7 : value),
  );
}
