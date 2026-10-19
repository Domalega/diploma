// The React UI keeps its existing API contracts. Android persists the complete
// account snapshot atomically; this adapter applies the same commands locally.
const clone = (v) => JSON.parse(JSON.stringify(v));
const entries = (state, prefix) =>
  Object.entries(state)
    .filter(([key]) => key.startsWith(prefix + "/"))
    .map(([key, v]) => ({ id: key.slice(prefix.length + 1), ...v }));
const fail = (message) => {
  throw new Error(message);
};
const find = (state, prefix, id) => state[prefix + "/" + id] || fail("Task was not found");
const due = (row, date) =>
  date >= row.startDate &&
  (!row.endDate || date <= row.endDate) &&
  row.weekdays.includes(new Date(date + "T00:00:00Z").getUTCDay());
const uuid = () => window.crypto.randomUUID();
const sorted = (values) =>
  values.sort((a, b) => (a.position || 0) - (b.position || 0) || a.id.localeCompare(b.id));
function capacity(state, column, except) {
  if (
    column.wipLimit !== null &&
    entries(state, "task").filter(
      (t) => t.columnId === column.id && !t.completedAt && t.id !== except,
    ).length >= column.wipLimit
  )
    fail("This column has reached its work-in-progress limit");
}
export function localApi(document, path, method = "GET", body = {}) {
  const state = method === "GET" ? document.state : clone(document.state);
  const revision = document.generation;
  const userId = document.owner;
  const board = () => ({ userId, revision, ...state.board, tasks: sorted(entries(state, "task")) });
  const todos = () => ({
    userId,
    revision,
    ...state.todos,
    tasks: sorted(entries(state, "todo")).map(({ position, ...task }) => task),
  });
  const plan = () => ({ userId, revision, ...state.medications });
  const records = (date) => entries(state, "intake").filter((r) => r.date === date);
  let result;
  if (method === "GET") {
    if (path === "/userDate/get")
      result = entries(state, "note").sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      );
    else if (path === "/todos") result = todos();
    else if (path === "/kanban") result = board();
    else if (path.startsWith("/kanban/tasks/") && path.endsWith("/history")) {
      const id = decodeURIComponent(path.split("/")[3]);
      find(state, "task", id);
      result = document.history?.[id] || [];
    } else if (path === "/medications/plan") result = plan();
    else if (path.startsWith("/medications/intakes?date="))
      result = records(decodeURIComponent(path.split("=")[1]));
    else fail("This action requires an internet connection.");
    return { result: clone(result) };
  }
  const now = new Date().toISOString();
  if (path === "/userDate/create") {
    const id = uuid();
    state["note/" + id] = { date: body.date, time: body.time ?? null, comment: body.comment ?? "" };
    result = { message: "ok", note: { id, ...state["note/" + id] } };
  } else if (path === "/userDate/update") {
    const note = find(state, "note", body.id);
    Object.assign(note, {
      date: body.date ?? note.date,
      time: body.time === undefined ? note.time : body.time,
      comment: body.comment,
    });
    result = { message: "Note was updated successfully" };
  } else if (path === "/userDate/delete") {
    find(state, "note", body.id);
    delete state["note/" + body.id];
    result = { message: "Note was deleted successfully" };
  } else if (path === "/todos") {
    if (body.type === "enabled") state.todos.enabled = body.enabled;
    else {
      if (!state.todos.enabled) fail("Enable the to-do list first");
      if (body.type === "add") {
        const tasks = entries(state, "todo");
        if (tasks.length + body.titles.length > 1000) fail("Use up to 1000 to-do tasks");
        const position = Math.max(-1, ...tasks.map((t) => t.position));
        body.titles.forEach((title, index) => {
          state["todo/" + uuid()] = {
            title: title.trim(),
            completed: false,
            ...(body.date !== undefined ? { date: body.date } : {}),
            position: position + index + 1,
          };
        });
      } else {
        const task = find(state, "todo", body.id);
        if (body.type === "complete") task.completed = body.completed;
        else if (body.type === "edit") {
          task.title = body.title.trim();
          if (body.date !== undefined) task.date = body.date;
        } else if (body.type === "remove") delete state["todo/" + body.id];
        else fail("Enter a valid to-do update");
      }
    }
    result = todos();
  } else if (path === "/kanban") {
    const columns = state.board.columns;
    const column = (id) => columns.find((c) => c.id === id) || fail("Column was not found");
    if (body.type === "enabled") state.board.enabled = body.enabled;
    else {
      if (!state.board.enabled) fail("Enable the Kanban board first");
      switch (body.type) {
        case "task.delete":
          find(state, "task", body.taskId);
          delete state["task/" + body.taskId];
          break;
        case "column.create":
          if (columns.length >= 30) fail("Use up to 30 columns");
          columns.splice(
            columns.findIndex((c) => c.id === "done"),
            0,
            { id: uuid(), name: body.name.trim(), kind: "doing", hidden: false, wipLimit: null },
          );
          break;
        case "column.update": {
          const c = column(body.columnId);
          if (body.name !== undefined) c.name = body.name.trim();
          if (body.hidden !== undefined) c.hidden = body.hidden;
          if (body.wipLimit !== undefined) {
            if (
              body.wipLimit !== null &&
              entries(state, "task").filter((t) => t.columnId === c.id && !t.completedAt).length >
                body.wipLimit
            )
              fail("The limit cannot be lower than the current task count");
            c.wipLimit = body.wipLimit;
          }
          break;
        }
        case "column.move": {
          const c = column(body.columnId);
          columns.splice(columns.indexOf(c), 1);
          columns.splice(body.index, 0, c);
          break;
        }
        case "task.create": {
          const c = column(body.columnId);
          capacity(state, c);
          state["task/" + uuid()] = {
            columnId: c.id,
            title: body.title.trim(),
            description: (body.description || "").trim(),
            date: body.date || null,
            position:
              Math.max(
                -1,
                ...entries(state, "task")
                  .filter((t) => t.columnId === c.id)
                  .map((t) => t.position),
              ) + 1,
            startedAt: c.kind === "todo" ? null : now,
            completedAt: c.kind === "done" ? now : null,
          };
          break;
        }
        case "task.update":
          Object.assign(find(state, "task", body.taskId), {
            title: body.title.trim(),
            description: (body.description || "").trim(),
            date: body.date || null,
          });
          break;
        case "task.move":
        case "task.complete":
        case "task.reopen": {
          const task = find(state, "task", body.taskId);
          const c = column(
            body.type === "task.complete"
              ? "done"
              : body.type === "task.reopen"
                ? "todo"
                : body.columnId,
          );
          capacity(state, c, body.taskId);
          const target = sorted(
            entries(state, "task").filter((t) => t.columnId === c.id && t.id !== body.taskId),
          );
          let index = body.beforeId
            ? target.findIndex((t) => t.id === body.beforeId)
            : target.length;
          if (index < 0) fail("Choose a valid task position");
          Object.assign(task, {
            columnId: c.id,
            startedAt: task.startedAt || (c.kind !== "todo" ? now : null),
            completedAt: c.kind === "done" ? task.completedAt || now : null,
          });
          target.splice(index, 0, { id: body.taskId, ...task });
          target.forEach((t, position) => {
            state["task/" + t.id].position = position;
          });
          break;
        }
        default:
          fail("Unknown board update");
      }
    }
    result = board();
  } else if (path === "/medications/plan") {
    const { enabled, reminders, rows, slots } = body;
    state.medications = { enabled, reminders, rows, slots };
    result = plan();
  } else if (["/medications/intakes", "/medications/intakes/column"].includes(path)) {
    const p = state.medications;
    if (!p.enabled) fail("Enable the experimental medication tracker first.");
    const slot = p.slots.find((s) => s.id === body.slotId);
    const rows = path.endsWith("/column")
      ? p.rows.filter((r) => r.slotIds.includes(body.slotId) && due(r, body.date))
      : [p.rows.find((r) => r.id === body.medicationId) || { id: body.medicationId }];
    if (!rows.length) fail("No medications are scheduled for this column");
    for (const row of rows) {
      const key = `intake/${body.date}/${row.id}/${body.slotId}`;
      if (body.taken) {
        if (!slot || !row.slotIds?.includes(slot.id) || !due(row, body.date))
          fail("This medication is not scheduled for this time and day");
        state[key] ||= {
          date: body.date,
          medicationId: row.id,
          slotId: slot.id,
          takenAt: now,
          nameSnapshot: row.name,
          detailSnapshot: row.detail || "",
          timeSnapshot: slot.time,
          slotLabelSnapshot: slot.label || "",
        };
      } else delete state[key];
    }
    result = { records: records(body.date) };
  } else fail("This action requires an internet connection.");
  return {
    result: { ...result, ...(result.revision === undefined ? {} : { revision: revision + 1 }) },
    state,
  };
}
