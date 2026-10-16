const { createHash, randomUUID } = require("node:crypto");
const {
  UserDate,
  SyncNoteKey,
  SyncReceipt,
  TodoList,
  KanbanBoard,
  KanbanTask,
  KanbanEvent,
  MedicationPlan,
  MedicationIntake,
} = require("../models");
const { defaults: boardDefaults } = require("./kanbanService");
const { defaultPlan, isDue } = require("./medicationService");
const { planIsValid, validDate } = require("./medicationValidation");
const userWrite = require("./userWrite");
const { canonical, equal, merge } = require("./syncMerge");
const ApiError = require("../errors/ApiError");
const uuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const pick = (v, keys) => Object.fromEntries(keys.map((k) => [k, v[k] ?? null]));
const noteFields = ["date", "time", "comment"];
const taskFields = [
  "columnId",
  "title",
  "description",
  "date",
  "position",
  "startedAt",
  "completedAt",
];
const intakeFields = [
  "date",
  "medicationId",
  "slotId",
  "takenAt",
  "nameSnapshot",
  "detailSnapshot",
  "timeSnapshot",
  "slotLabelSnapshot",
];
const bad = (message = "Invalid offline data") => {
  throw ApiError.badRequest(message);
};
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const string = (v, max, required = false) =>
  typeof v === "string" && v.length <= max && (!required || !!v.trim());
const integer = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1000000;
const timestamp = (v) => typeof v === "string" && v.length <= 30 && !Number.isNaN(Date.parse(v));
const intakeKey = (v) => `intake/${v.date}/${v.medicationId}/${v.slotId}`;

async function snapshot(userId, transaction) {
  const state = Object.create(null);
  const notes = await UserDate.findAll({ where: { userId }, transaction });
  const keys = await SyncNoteKey.findAll({ where: { userId }, transaction });
  const keyById = new Map(keys.map((v) => [v.noteId, v.key]));
  for (const note of notes) {
    let key = keyById.get(note.id);
    if (!key) {
      key = randomUUID();
      await SyncNoteKey.create({ userId, key, noteId: note.id }, { transaction });
    }
    state["note/" + key] = pick(note, noteFields);
  }
  const list = await TodoList.findByPk(userId, { transaction });
  state.todos = { enabled: list?.enabled || false };
  (list?.tasks || []).forEach((task, position) => {
    state["todo/" + task.id] = {
      title: task.title,
      completed: task.completed,
      position,
      ...(task.date !== undefined ? { date: task.date } : {}),
    };
  });
  const board = await KanbanBoard.findByPk(userId, { transaction });
  state.board = pick(board || boardDefaults(userId), ["enabled", "columns"]);
  for (const task of await KanbanTask.findAll({ where: { userId }, transaction }))
    state["task/" + task.id] = pick(task, taskFields);
  const plan = await MedicationPlan.findByPk(userId, { transaction });
  state.medications = pick(plan || defaultPlan(userId), ["enabled", "reminders", "rows", "slots"]);
  for (const intake of await MedicationIntake.findAll({ where: { userId }, transaction }))
    state[intakeKey(intake)] = pick(intake, intakeFields);
  const history = {};
  for (const event of await KanbanEvent.findAll({
    where: { userId },
    order: [["id", "DESC"]],
    transaction,
  })) {
    (history[event.taskId] ||= []).push(event.toJSON());
  }
  return JSON.parse(JSON.stringify({ version: 1, state, history }));
}
function validate(state) {
  if (!object(state) || Object.keys(state).length > 20000) bad();
  if (!object(state.todos) || typeof state.todos.enabled !== "boolean") bad();
  const board = state.board,
    plan = state.medications;
  if (
    !object(board) ||
    typeof board.enabled !== "boolean" ||
    !Array.isArray(board.columns) ||
    !board.columns.length ||
    board.columns.length > 30
  )
    bad();
  const ids = new Set();
  for (const c of board.columns) {
    if (
      !object(c) ||
      !(uuid(c.id) || ["todo", "doing", "done"].includes(c.id)) ||
      ids.has(c.id) ||
      !["todo", "doing", "done"].includes(c.kind) ||
      typeof c.hidden !== "boolean" ||
      !string(c.name, 60) ||
      (c.wipLimit !== null &&
        (!integer(c.wipLimit) || c.wipLimit < 1 || c.wipLimit > 99 || c.kind !== "doing"))
    )
      bad();
    ids.add(c.id);
  }
  for (const id of ["todo", "doing", "done"])
    if (!board.columns.some((c) => c.id === id && c.kind === id)) bad();
  if (!object(plan)) bad();
  try {
    planIsValid({ ...plan, revision: 0 });
  } catch (error) {
    bad(error.message);
  }
  let todos = 0;
  for (const [key, value] of Object.entries(state)) {
    if (["todos", "board", "medications"].includes(key)) continue;
    if (!object(value)) bad();
    const [kind, id] = key.split("/");
    if (kind !== "intake" && (!uuid(id) || key !== kind + "/" + id)) bad();
    switch (kind) {
      case "note":
        if (
          !validDate(value.date) ||
          !(value.time === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) ||
          !(value.comment === null || string(value.comment, 255))
        )
          bad();
        break;
      case "todo":
        if (++todos > 1000) bad("Use up to 1000 to-do tasks");
        if (
          !string(value.title, 500, true) ||
          /[\r\n]/.test(value.title) ||
          typeof value.completed !== "boolean" ||
          !(value.date === undefined || value.date === null || validDate(value.date)) ||
          !integer(value.position)
        )
          bad();
        break;
      case "task": {
        const column = board.columns.find((c) => c.id === value.columnId);
        if (
          !column ||
          !string(value.title, 140, true) ||
          !string(value.description, 4000) ||
          !(value.date === null || validDate(value.date)) ||
          !integer(value.position) ||
          !(value.startedAt === null || timestamp(value.startedAt)) ||
          !(value.completedAt === null || timestamp(value.completedAt)) ||
          (column.kind === "done") !== !!value.completedAt
        )
          bad();
        break;
      }
      case "intake":
        if (
          key !== intakeKey(value) ||
          !validDate(value.date) ||
          !uuid(value.medicationId) ||
          !uuid(value.slotId) ||
          !timestamp(value.takenAt) ||
          !string(value.nameSnapshot, 80, true) ||
          !string(value.detailSnapshot, 120) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.timeSnapshot) ||
          !string(value.slotLabelSnapshot, 40)
        )
          bad();
        break;
      default:
        bad();
    }
  }
  for (const c of board.columns) {
    if (
      c.wipLimit !== null &&
      Object.entries(state).filter(
        ([k, v]) => k.startsWith("task/") && v.columnId === c.id && !v.completedAt,
      ).length > c.wipLimit
    )
      bad("This column has reached its work-in-progress limit");
  }
}
async function apply(userId, before, after, transaction) {
  const options = { transaction };
  let boardChanged = !equal(before.board, after.board),
    todosChanged = !equal(before.todos, after.todos);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (equal(before[key], after[key])) continue;
    const value = after[key],
      previous = before[key],
      [kind, id] = key.split("/");
    if (kind === "note") {
      const mapping = await SyncNoteKey.findOne({ where: { userId, key: id }, transaction });
      if (!value) {
        if (mapping) await UserDate.destroy({ where: { userId, id: mapping.noteId }, transaction });
      } else if (mapping)
        await UserDate.update(pick(value, noteFields), {
          where: { userId, id: mapping.noteId },
          transaction,
        });
      else {
        const note = await UserDate.create({ userId, ...pick(value, noteFields) }, options);
        await SyncNoteKey.create({ userId, key: id, noteId: note.id }, options);
      }
    }
    if (kind === "todo") todosChanged = true;
    if (kind === "task") {
      boardChanged = true;
      if (!value) await KanbanTask.destroy({ where: { userId, id }, transaction });
      else {
        if (previous)
          await KanbanTask.update(pick(value, taskFields), { where: { userId, id }, transaction });
        else await KanbanTask.create({ id, userId, ...pick(value, taskFields) }, options);
        const eventKind = !previous
          ? "created"
          : !previous.completedAt && value.completedAt
            ? "completed"
            : previous.completedAt && !value.completedAt
              ? "reopened"
              : previous.columnId !== value.columnId || previous.position !== value.position
                ? "moved"
                : "edited";
        await KanbanEvent.create(
          {
            userId,
            taskId: id,
            kind: eventKind,
            details: {
              from: previous?.columnId,
              to: value.columnId,
              title: value.title,
              date: value.date,
              source: "offline",
            },
          },
          options,
        );
      }
    }
    if (kind === "intake") {
      const v = value || previous;
      const where = { userId, date: v.date, medicationId: v.medicationId, slotId: v.slotId };
      if (!value) await MedicationIntake.destroy({ where, transaction });
      else {
        const row = after.medications.rows.find((r) => r.id === value.medicationId);
        const slot = after.medications.slots.find((s) => s.id === value.slotId);
        // Existing historical marks survive a schedule change. New marks must be due.
        if (
          !previous &&
          (!after.medications.enabled ||
            !row ||
            !slot ||
            !row.slotIds.includes(slot.id) ||
            !isDue(row, value.date))
        )
          bad("This medication is not scheduled for this time and day");
        if (previous)
          await MedicationIntake.update(pick(value, intakeFields), { where, transaction });
        else await MedicationIntake.create({ userId, ...pick(value, intakeFields) }, options);
      }
    }
  }
  if (boardChanged) {
    const [board] = await KanbanBoard.findOrCreate({
      where: { userId },
      defaults: boardDefaults(userId),
      transaction,
    });
    await board.update(
      { ...pick(after.board, ["enabled", "columns"]), revision: board.revision + 1 },
      options,
    );
  }
  if (todosChanged) {
    const [list] = await TodoList.findOrCreate({ where: { userId }, transaction });
    const tasks = Object.entries(after)
      .filter(([k]) => k.startsWith("todo/"))
      .sort(([a, x], [b, y]) => x.position - y.position || a.localeCompare(b))
      .map(([k, v]) => ({
        id: k.slice(5),
        title: v.title,
        completed: v.completed,
        ...(v.date !== undefined ? { date: v.date } : {}),
      }));
    await list.update(
      { enabled: after.todos.enabled, tasks, revision: list.revision + 1 },
      options,
    );
  }
  if (!equal(before.medications, after.medications)) {
    const [plan] = await MedicationPlan.findOrCreate({
      where: { userId },
      defaults: defaultPlan(userId),
      transaction,
    });
    await plan.update(
      {
        ...pick(after.medications, ["enabled", "reminders", "rows", "slots"]),
        revision: plan.revision + 1,
      },
      options,
    );
  }
}
const getSnapshot = (userId) => userWrite(userId, (transaction) => snapshot(userId, transaction));
async function exchange(userId, command) {
  if (!object(command) || command.version !== 1 || !uuid(command.operationId)) bad();
  validate(command.base);
  validate(command.local);
  const digest = createHash("sha256")
    .update(canonical({ base: command.base, local: command.local }))
    .digest("hex");
  return userWrite(userId, async (transaction) => {
    const remote = await snapshot(userId, transaction);
    const receipt = await SyncReceipt.findOne({
      where: { userId, operationId: command.operationId },
      transaction,
    });
    if (receipt) {
      if (receipt.digest !== digest) bad("A sync request ID was reused with different data");
      return { ...remote, conflicts: [] };
    }
    const merged = merge(command.base, command.local, remote.state);
    if (merged.conflicts.length) return { ...remote, conflicts: merged.conflicts };
    try {
      validate(merged.state);
      for (const [key, value] of Object.entries(merged.state))
        if (key.startsWith("intake/") && !remote.state[key]) {
          const p = merged.state.medications,
            row = p.rows.find((r) => r.id === value.medicationId),
            slot = p.slots.find((s) => s.id === value.slotId);
          if (
            !p.enabled ||
            !row ||
            !slot ||
            !row.slotIds.includes(slot.id) ||
            !isDue(row, value.date)
          )
            bad("This medication is not scheduled for this time and day");
        }
    } catch (error) {
      // Independent edits can still violate a cross-entity rule (for example a WIP limit).
      const group = error.message.includes("medication")
        ? ["medications", "intake/"]
        : error.message.includes("1000")
          ? ["todos", "todo/"]
          : ["board", "task/"];
      let conflicts = [
        ...new Set([...Object.keys(command.local), ...Object.keys(remote.state)]),
      ].filter(
        (key) =>
          group.some(
            (prefix) =>
              key === prefix || key.startsWith(prefix + (prefix.endsWith("/") ? "" : "/")),
          ) && !equal(command.local[key], remote.state[key]),
      );
      if (!conflicts.length)
        conflicts = [
          ...new Set([...Object.keys(command.local), ...Object.keys(remote.state)]),
        ].filter((key) => !equal(command.local[key], remote.state[key]));
      return { ...remote, conflicts, message: error.message };
    }
    await apply(userId, remote.state, merged.state, transaction);
    await SyncReceipt.create({ userId, operationId: command.operationId, digest }, { transaction });
    return { ...(await snapshot(userId, transaction)), conflicts: [] };
  });
}
module.exports = { getSnapshot, exchange, validate };
