import { compareNotes } from "./noteTimes";

test("notes use date, time and stable numeric or offline UUID order", () => {
  const note = { date: "2026-10-19", time: null };
  const ids = ["ffffffff-0000-4000-8000-000000000001", "aaaaaaaa-0000-4000-8000-000000000001"];
  expect(
    [
      { ...note, id: 10 },
      { ...note, id: 2 },
    ]
      .sort(compareNotes)
      .map((n) => n.id),
  ).toEqual([2, 10]);
  expect(
    ids
      .map((id) => ({ ...note, id }))
      .sort(compareNotes)
      .map((n) => n.id),
  ).toEqual([...ids].reverse());
  expect(
    compareNotes({ ...note, id: 1, time: "09:00" }, { ...note, id: 2, time: "10:00" }),
  ).toBeLessThan(0);
});
