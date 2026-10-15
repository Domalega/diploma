import { translate } from "../../../shared/i18n/messages";
export const compareNotes = (a, b) =>
  a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "") || a.id - b.id;
export const noteTime = (note, locale = "en") => note.time || translate("All day", locale);
