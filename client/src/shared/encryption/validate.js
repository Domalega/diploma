const fail = (message = "Invalid encrypted document") => {
  throw new Error(message);
};
const date = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const time = (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const text = (v, max, required = false) =>
  typeof v === "string" && v.length <= max && (!required || !!v.trim());
const uuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const integer = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1000000;
export function validateDocument(document) {
  const state = document?.state;
  if (
    !state ||
    Array.isArray(state) ||
    !document.history ||
    Array.isArray(document.history) ||
    Object.keys(state).length > 20000 ||
    JSON.stringify(document).length > 1800000
  )
    fail();
  if (
    typeof state.todos?.enabled !== "boolean" ||
    typeof state.board?.enabled !== "boolean" ||
    typeof state.medications?.enabled !== "boolean" ||
    typeof state.medications?.reminders !== "boolean"
  )
    fail();
  const columns = state.board.columns;
  if (!Array.isArray(columns) || !columns.length || columns.length > 30) fail();
  const ids = new Set();
  for (const c of columns) {
    if (
      !c ||
      !(uuid(c.id) || ["todo", "doing", "done"].includes(c.id)) ||
      ids.has(c.id) ||
      !["todo", "doing", "done"].includes(c.kind) ||
      typeof c.hidden !== "boolean" ||
      !text(c.name, 60) ||
      !(
        c.wipLimit === null ||
        (integer(c.wipLimit) && c.wipLimit >= 1 && c.wipLimit <= 99 && c.kind === "doing")
      )
    )
      fail();
    ids.add(c.id);
  }
  for (const id of ["todo", "doing", "done"])
    if (!columns.some((c) => c.id === id && c.kind === id)) fail();
  const plan = state.medications;
  if (
    !Array.isArray(plan.rows) ||
    plan.rows.length > 40 ||
    !Array.isArray(plan.slots) ||
    plan.slots.length > 12
  )
    fail();
  const slots = new Set(),
    times = new Set(),
    rows = new Set();
  for (const s of plan.slots) {
    if (
      !s ||
      !uuid(s.id) ||
      slots.has(s.id) ||
      !time(s.time) ||
      times.has(s.time) ||
      !text(s.label, 40)
    )
      fail();
    slots.add(s.id);
    times.add(s.time);
  }
  for (const row of plan.rows) {
    if (
      !row ||
      !uuid(row.id) ||
      rows.has(row.id) ||
      !text(row.name, 80, true) ||
      !text(row.detail, 120) ||
      !Array.isArray(row.slotIds) ||
      !row.slotIds.length ||
      new Set(row.slotIds).size !== row.slotIds.length ||
      row.slotIds.some((id) => !slots.has(id)) ||
      !date(row.startDate) ||
      !(row.endDate === null || (date(row.endDate) && row.endDate >= row.startDate)) ||
      !Array.isArray(row.weekdays) ||
      !row.weekdays.length ||
      row.weekdays.length > 7 ||
      new Set(row.weekdays).size !== row.weekdays.length ||
      row.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    )
      fail();
    rows.add(row.id);
  }
  const counts = new Map();
  let todos = 0;
  for (const [key, v] of Object.entries(state)) {
    if (["board", "todos", "medications"].includes(key)) continue;
    if (!v || typeof v !== "object") fail();
    const [kind, id] = key.split("/");
    if (kind !== "intake" && (!uuid(id) || key !== kind + "/" + id)) fail();
    if (kind === "note") {
      if (
        !date(v.date) ||
        !(v.time === null || time(v.time)) ||
        !(v.comment === null || text(v.comment, 255))
      )
        fail();
    } else if (kind === "todo") {
      if (
        ++todos > 1000 ||
        !text(v.title, 500, true) ||
        /[\r\n]/.test(v.title) ||
        typeof v.completed !== "boolean" ||
        !(v.date == null || date(v.date)) ||
        !integer(v.position)
      )
        fail();
    } else if (kind === "task") {
      const c = columns.find((c) => c.id === v.columnId);
      if (
        !c ||
        !text(v.title, 140, true) ||
        !text(v.description, 4000) ||
        !(v.date === null || date(v.date)) ||
        !integer(v.position) ||
        (c.kind === "done") !== !!v.completedAt ||
        ![v.startedAt, v.completedAt].every(
          (t) => t === null || (typeof t === "string" && !Number.isNaN(Date.parse(t))),
        )
      )
        fail();
      if (!v.completedAt) counts.set(c.id, (counts.get(c.id) || 0) + 1);
    } else if (kind === "intake") {
      if (
        key !== `intake/${v.date}/${v.medicationId}/${v.slotId}` ||
        !date(v.date) ||
        !uuid(v.medicationId) ||
        !uuid(v.slotId) ||
        !text(v.nameSnapshot, 80, true) ||
        !text(v.detailSnapshot, 120) ||
        !text(v.slotLabelSnapshot, 40) ||
        !time(v.timeSnapshot) ||
        typeof v.takenAt !== "string" ||
        Number.isNaN(Date.parse(v.takenAt))
      )
        fail();
    } else fail();
  }
  for (const c of columns)
    if (c.wipLimit !== null && (counts.get(c.id) || 0) > c.wipLimit)
      fail("This column has reached its work-in-progress limit");
  return true;
}

export function validateNewIntakes(before, after) {
  const plan = after.state.medications;
  for (const [key, value] of Object.entries(after.state)) {
    if (!key.startsWith("intake/") || before.state[key]) continue;
    const row = plan.rows.find((r) => r.id === value.medicationId);
    const slot = plan.slots.find((s) => s.id === value.slotId);
    if (
      !plan.enabled ||
      !row ||
      !slot ||
      !row.slotIds.includes(slot.id) ||
      value.date < row.startDate ||
      (row.endDate && value.date > row.endDate) ||
      !row.weekdays.includes(new Date(value.date + "T00:00:00Z").getUTCDay())
    )
      fail("This medication is not scheduled for this time and day");
  }
}
