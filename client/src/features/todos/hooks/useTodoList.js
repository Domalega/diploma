import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
import * as api from "../api/todoApi";
import useSyncRefresh from "../../../shared/offline/useSyncRefresh";

export const emptyList = { enabled: false, revision: 0, tasks: [] };
export default function useTodoList() {
  const [list, setList] = useState(emptyList);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const current = useRef(list);
  const mutating = useRef(false);
  const refreshAfterWrite = useRef(false);
  const controller = useRef(null);
  const epoch = useRef(0);
  const alive = useRef(true);
  const navigate = useNavigate();
  const handleError = useCallback(
    (error) => {
      if (error.status === 401) navigate(LOGIN_ROUTE, { replace: true });
      else {
        setError(error.message);
        if (
          error.status === 409 &&
          error.message === "The to-do list changed. Reload it before saving."
        )
          setConflict(true);
      }
    },
    [navigate],
  );
  const reload = useCallback(async () => {
    if (mutating.current) {
      refreshAfterWrite.current = true;
      return;
    }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const requestId = ++epoch.current;
    setLoading(true);
    setError("");
    try {
      const saved = await api.getList(abort.signal);
      if (!alive.current || abort.signal.aborted || requestId !== epoch.current) return;
      current.current = saved;
      setList(saved);
      setConflict(false);
    } catch (error) {
      if (alive.current && !abort.signal.aborted && requestId === epoch.current) handleError(error);
    } finally {
      if (alive.current && requestId === epoch.current) setLoading(false);
    }
  }, [handleError]);
  useSyncRefresh(reload);
  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, [reload]);
  async function send(command) {
    if (mutating.current || loading || conflict)
      throw new Error("Reload the to-do list before making another change");
    mutating.current = true;
    ++epoch.current;
    controller.current?.abort();
    setPending(true);
    setError("");
    try {
      const saved = await api.changeList({ ...command, revision: current.current.revision });
      if (alive.current) {
        current.current = saved;
        setList(saved);
      }
      return saved;
    } catch (error) {
      if (alive.current) handleError(error);
      throw error;
    } finally {
      mutating.current = false;
      if (alive.current) setPending(false);
      if (alive.current && refreshAfterWrite.current) {
        refreshAfterWrite.current = false;
        reload();
      }
    }
  }
  return { list, loading, pending, error, conflict, reload, send };
}
