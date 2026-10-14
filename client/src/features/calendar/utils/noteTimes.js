export const compareNotes = (a, b) =>
  a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "") || a.id - b.id;
export const noteTime = (note) => note.time || "All day";
