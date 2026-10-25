import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api/medicationApi";
import { emptyPlan } from "../utils/schedule";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
import useSyncRefresh from "../../../shared/offline/useSyncRefresh";
import {
  cacheSession,
  readCachedResource,
  saveCachedResource,
  removeCachedResources,
} from "../../../shared/api/browserCache";

function cachedSelection(date, today, session) {
  const plan = readCachedResource("medication-plan", session);
  const days = date === today ? [date] : [date, today];
  const entries = days.map((day) => [day, readCachedResource("intakes:" + day, session)]);
  return {
    plan,
    records: Object.fromEntries(entries.filter(([, records]) => records !== undefined)),
    ready:
      plan !== undefined &&
      (!plan.enabled || entries.every(([, records]) => records !== undefined)),
  };
}

export default function useMedicationTracker(date, today) {
  const [cache] = useState(() => {
    const session = cacheSession();
    return { session, ...cachedSelection(date, today, session) };
  });
  const [plan, setPlan] = useState(() => cache.plan ?? emptyPlan);
  const [recordsByDate, setRecords] = useState(cache.records);
  const [loading, setLoading] = useState(!cache.ready);
  const [loadedSelection, setLoadedSelection] = useState(cache.ready ? date + ":" + today : "");
  const loaded = useRef(loadedSelection);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const epoch = useRef(0);
  const controller = useRef(null);
  const mutating = useRef(false);
  const refreshAfterWrite = useRef(false);
  const latestReload = useRef(null);
  const selection = date + ":" + today;
  const handleError = useCallback(
    (error) => {
      if (error.status === 401) navigate(LOGIN_ROUTE, { replace: true });
      else setError(error.message);
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
    const current = ++epoch.current;
    const cached = cachedSelection(date, today, cache.session);
    if (cached.ready && loaded.current !== date + ":" + today) {
      setPlan(cached.plan);
      setRecords((previous) => ({ ...previous, ...cached.records }));
      loaded.current = date + ":" + today;
      setLoadedSelection(loaded.current);
    }
    setLoading(loaded.current !== date + ":" + today);
    setError("");
    try {
      const saved = await api.getPlan(abort.signal);
      const days = date === today ? [date] : [date, today];
      const entries = saved.enabled
        ? await Promise.all(days.map(async (day) => [day, await api.getIntakes(day, abort.signal)]))
        : [];
      if (abort.signal.aborted || current !== epoch.current) return;
      setPlan((previous) => (previous.revision > saved.revision ? previous : saved));
      setRecords((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
      saveCachedResource("medication-plan", saved, cache.session);
      for (const [day, records] of entries)
        saveCachedResource("intakes:" + day, records, cache.session);
      loaded.current = date + ":" + today;
      setLoadedSelection(date + ":" + today);
    } catch (error) {
      if (!abort.signal.aborted && current === epoch.current) handleError(error);
    } finally {
      if (current === epoch.current) setLoading(false);
    }
  }, [date, today, handleError, cache]);
  latestReload.current = reload;
  useSyncRefresh(reload);
  useEffect(() => {
    reload();
    return () => controller.current?.abort();
  }, [reload]);
  async function mutate(action) {
    if (mutating.current) throw new Error("Wait for the current medication update to finish.");
    mutating.current = true;
    ++epoch.current;
    controller.current?.abort();
    setPending(true);
    setLoading(false);
    setError("");
    try {
      return await action();
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      mutating.current = false;
      setPending(false);
      if (refreshAfterWrite.current) {
        refreshAfterWrite.current = false;
        latestReload.current();
      }
    }
  }
  function savePlan(changes) {
    return mutate(async () => {
      const saved = await api.savePlan({ ...plan, ...changes, revision: plan.revision });
      setPlan(saved);
      removeCachedResources("intakes:", cache.session);
      saveCachedResource("medication-plan", saved, cache.session);
      if (saved.enabled) {
        const days = date === today ? [date] : [date, today];
        try {
          const entries = await Promise.all(
            days.map(async (day) => [day, await api.getIntakes(day)]),
          );
          setRecords((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
          for (const [day, records] of entries)
            saveCachedResource("intakes:" + day, records, cache.session);
        } catch (error) {
          handleError(error);
        }
      }
      return saved;
    });
  }
  function mark(values, wholeColumn = false) {
    return mutate(async () => {
      const result = await (wholeColumn ? api.markColumn : api.markCell)({
        ...values,
        revision: plan.revision,
      });
      setRecords((previous) => ({ ...previous, [values.date]: result.records }));
      saveCachedResource("intakes:" + values.date, result.records, cache.session);
      return result.records;
    });
  }
  return {
    plan,
    records: recordsByDate[date] || [],
    todayRecords: recordsByDate[today] || [],
    loading: loading || (!error && loadedSelection !== selection),
    pending,
    error,
    reload,
    savePlan,
    mark,
  };
}
