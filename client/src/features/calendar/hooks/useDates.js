import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as datesApi from "../api/datesApi";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
import useSyncRefresh from "../../../shared/offline/useSyncRefresh";

export default function useDates() {
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef(null);
  const epoch = useRef(0);
  const writes = useRef(0);
  const refreshAfterWrite = useRef(false);
  const alive = useRef(true);
  const navigate = useNavigate();
  const handleError = useCallback(
    (error) => {
      if (error.status === 401) navigate(LOGIN_ROUTE, { replace: true });
      else setError(error.message);
    },
    [navigate],
  );
  const reload = useCallback(async () => {
    if (writes.current) {
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
      const data = await datesApi.getAllDates(abort.signal);
      if (alive.current && !abort.signal.aborted && requestId === epoch.current) setDates(data);
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

  async function mutate(action, apply) {
    writes.current++;
    ++epoch.current;
    controller.current?.abort();
    setLoading(false);
    try {
      await action();
      if (alive.current) {
        apply();
        setError("");
      }
    } catch (error) {
      if (alive.current && error.status === 401) handleError(error);
      throw error;
    } finally {
      writes.current--;
      if (alive.current && !writes.current && refreshAfterWrite.current) {
        refreshAfterWrite.current = false;
        await reload();
      }
    }
  }
  const create = (date, comment, time) =>
    mutate(
      () => datesApi.createDate(date, comment, time),
      () => {
        refreshAfterWrite.current = true;
      },
    );
  const remove = (id) =>
    mutate(
      () => datesApi.deleteDate(id),
      () => {
        setDates((items) => items.filter((item) => item.id !== id));
      },
    );
  const update = (id, changes) =>
    mutate(
      () => datesApi.updateDate(id, changes),
      () => {
        setDates((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
      },
    );
  return { dates, loading, error, reload, create, update, remove };
}
