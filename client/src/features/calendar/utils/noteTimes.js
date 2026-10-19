import { translate } from "../../../shared/i18n/messages";
const compareIds = new Intl.Collator("en", { numeric: true }).compare;
export const compareNotes = (a, b) =>
  a.date.localeCompare(b.date) ||
  (a.time || "").localeCompare(b.time || "") ||
  compareIds(a.id, b.id);
export const noteTime = (note, locale = "en") => note.time || translate("All day", locale);
