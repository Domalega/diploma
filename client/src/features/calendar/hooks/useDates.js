import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as datesApi from "../api/datesApi";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
import useSyncRefresh from "../../../shared/offline/useSyncRefresh";

export default function useDates() {
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const handleError = useCallback(
    (error) => {
      if (error.status === 401) navigate(LOGIN_ROUTE, { replace: true });
      else setError(error.message);
    },
    [navigate],
  );

  const reload = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const data = await datesApi.getAllDates(signal);
        if (!signal?.aborted) setDates(data);
      } catch (error) {
        if (!signal?.aborted) handleError(error);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [handleError],
  );

  useSyncRefresh(reload);
  useEffect(() => {
    const controller = new AbortController();
    reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  async function create(date, comment, time) {
    try {
      await datesApi.createDate(date, comment, time);
      await reload();
    } catch (error) {
      if (error.status === 401) handleError(error);
      throw error;
    }
  }
  async function remove(id) {
    try {
      await datesApi.deleteDate(id);
      setDates((items) => items.filter((item) => item.id !== id));
      setError("");
    } catch (error) {
      if (error.status === 401) handleError(error);
      throw error;
    }
  }
  async function update(id, changes) {
    try {
      await datesApi.updateDate(id, changes);
      setDates((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
      setError("");
    } catch (error) {
      if (error.status === 401) handleError(error);
      throw error;
    }
  }
  return { dates, loading, error, reload, create, update, remove };
}
