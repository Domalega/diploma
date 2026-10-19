export const columnName = (column, t) =>
  column.name || t({ todo: "To do", doing: "In progress", done: "Done" }[column.kind]);
export function groupTasksByColumn(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    if (!groups.has(task.columnId)) groups.set(task.columnId, []);
    groups.get(task.columnId).push(task);
  }
  for (const group of groups.values())
    group.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  return groups;
}
