// Parse date-only values locally: UTC parsing can move a note to the previous day.
export function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(0);
  result.setFullYear(year, month - 1, day);
  result.setHours(12, 0, 0, 0);
  return result;
}
export function dateKey(date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export const todayKey = () => dateKey(new Date());
export function monthStart(value) {
  const date = parseDate(value);
  date.setDate(1);
  return dateKey(date);
}
export function moveDays(value, offset) {
  const date = parseDate(value);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}
export function moveMonths(value, offset) {
  const date = parseDate(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return dateKey(date);
}
export const formatDay = (value, locale = "en") =>
  new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parseDate(value));
export const formatMonth = (value, locale = "en") =>
  new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(parseDate(value));
export function monthDays(value) {
  const first = monthStart(value);
  const start = moveDays(first, -((parseDate(first).getDay() + 6) % 7));
  // Keep six weeks visible so navigating between months never resizes the board.
  return Array.from({ length: 42 }, (_, index) => moveDays(start, index));
}
