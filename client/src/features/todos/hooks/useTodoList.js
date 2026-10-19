import useRevisionedResource from "../../../shared/api/useRevisionedResource";
import { getList, changeList } from "../api/todoApi";

export const emptyList = { enabled: false, revision: 0, tasks: [] };
export default function useTodoList() {
  const { data: list, ...state } = useRevisionedResource({
    initial: emptyList,
    read: getList,
    write: changeList,
    conflictMessage: "The to-do list changed. Reload it before saving.",
    busyMessage: "Reload the to-do list before making another change",
  });
  return { list, ...state };
}
