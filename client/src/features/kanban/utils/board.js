export const columnName = (column, t) =>
  column.name || t({ todo: "To do", doing: "In progress", done: "Done" }[column.kind]);
export const orderedTasks = (tasks, columnId) =>
  tasks
    .filter((task) => task.columnId === columnId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
