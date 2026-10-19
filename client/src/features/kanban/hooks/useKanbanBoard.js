import useRevisionedResource from "../../../shared/api/useRevisionedResource";
import { getBoard, changeBoard } from "../api/kanbanApi";

export const emptyBoard = { enabled: false, revision: 0, columns: [], tasks: [] };
export default function useKanbanBoard() {
  const { data: board, ...state } = useRevisionedResource({
    initial: emptyBoard,
    read: getBoard,
    write: changeBoard,
    conflictMessage: "The board changed. Reload it before saving.",
    busyMessage: "Reload the board before making another change",
  });
  return { board, ...state };
}
