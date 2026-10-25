import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import useMedicationTracker from "./useMedicationTracker";
import * as api from "../api/medicationApi";
import { emptyPlan } from "../utils/schedule";
import {
  cacheSession,
  readCachedResource,
  saveCachedResource,
} from "../../../shared/api/browserCache";
jest.mock("../api/medicationApi");
beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
});
function Probe({ date = "2026-10-14", today = "2026-10-14" }) {
  const tracker = useMedicationTracker(date, today);
  return (
    <>
      <p data-testid="plan">
        {tracker.plan.enabled ? "on" : "off"}:{tracker.plan.revision}
      </p>
      <p data-testid="count">{tracker.records.length}</p>
      <p data-testid="today-count">{tracker.todayRecords.length}</p>
      <p data-testid="loading">{String(tracker.loading)}</p>
      {tracker.error && <p role="alert">{tracker.error}</p>}
      <button onClick={() => tracker.savePlan({ enabled: true }).catch(() => {})}>Enable</button>
      <button
        onClick={() =>
          tracker.mark({ date, medicationId: "a", slotId: "morning", taken: true }).catch(() => {})
        }
      >
        Mark
      </button>
    </>
  );
}
test("the default stays disabled, enabling saves its revision and a different day also loads today's marks", async () => {
  api.getPlan.mockResolvedValue({ ...emptyPlan, userId: 7 });
  api.getIntakes.mockResolvedValue([]);
  api.savePlan.mockResolvedValue({ ...emptyPlan, userId: 7, enabled: true, revision: 1 });
  const view = render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  expect(api.getIntakes).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Enable"));
  await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("on:1"));
  expect(api.savePlan).toHaveBeenCalledWith(
    expect.objectContaining({ enabled: true, revision: 0 }),
  );
  api.getPlan.mockResolvedValue({ ...emptyPlan, userId: 7, enabled: true, revision: 1 });
  api.getIntakes.mockImplementation(async (date) =>
    date === "2026-10-14" ? [{ medicationId: "a", slotId: "morning", date }] : [],
  );
  view.rerender(
    <MemoryRouter>
      <Probe date="2026-10-15" />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId("today-count")).toHaveTextContent("1"));
  expect(screen.getByTestId("count")).toHaveTextContent("0");
});

test("switching days during a write waits for it before loading the new day's marks", async () => {
  api.getPlan.mockResolvedValue({ ...emptyPlan, userId: 7, enabled: true, revision: 4 });
  api.getIntakes.mockResolvedValue([]);
  let finish;
  api.markCell.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  fireEvent.click(screen.getByText("Mark"));
  view.rerender(
    <MemoryRouter>
      <Probe date="2026-10-15" today="2026-10-15" />
    </MemoryRouter>,
  );
  expect(screen.getByTestId("loading")).toHaveTextContent("true");
  expect(api.getPlan).toHaveBeenCalledTimes(1);
  api.getIntakes.mockResolvedValue([{ medicationId: "b", slotId: "morning", date: "2026-10-15" }]);
  await act(async () =>
    finish({ records: [{ medicationId: "a", slotId: "morning", date: "2026-10-14" }] }),
  );
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  expect(api.getIntakes).toHaveBeenLastCalledWith("2026-10-15", expect.any(AbortSignal));
  expect(screen.getByTestId("today-count")).toHaveTextContent("1");
});
test("failed intake writes preserve marks and a successful write sends the schedule revision", async () => {
  api.getPlan.mockResolvedValue({ ...emptyPlan, userId: 7, enabled: true, revision: 4 });
  const existing = [{ medicationId: "old", slotId: "morning", date: "2026-10-14" }];
  api.getIntakes.mockResolvedValue(existing);
  api.markCell.mockRejectedValueOnce(new Error("Could not save")).mockResolvedValue({
    records: [...existing, { medicationId: "a", slotId: "morning", date: "2026-10-14" }],
  });
  render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  fireEvent.click(screen.getByText("Mark"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  expect(screen.getByTestId("count")).toHaveTextContent("1");
  fireEvent.click(screen.getByText("Mark"));
  await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
  expect(api.markCell).toHaveBeenLastCalledWith({
    date: "2026-10-14",
    medicationId: "a",
    slotId: "morning",
    taken: true,
    revision: 4,
  });
});

test("cached schedule and marks open immediately and selecting another cached day stays ready", async () => {
  localStorage.setItem("token", `header.${btoa(JSON.stringify({ id: 7 }))}.signature`);
  const session = cacheSession();
  const plan = { ...emptyPlan, enabled: true, revision: 4 };
  const records = [{ medicationId: "a", slotId: "morning", date: "2026-10-14" }];
  saveCachedResource("medication-plan", plan, session);
  saveCachedResource("intakes:2026-10-14", records, session);
  saveCachedResource("intakes:2026-10-15", [], session);
  api.getPlan.mockReturnValue(new Promise(() => {}));
  api.markCell.mockResolvedValue({ records: [] });
  const view = render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
  expect(screen.getByTestId("plan")).toHaveTextContent("on:4");
  expect(screen.getByTestId("loading")).toHaveTextContent("false");
  expect(screen.getByTestId("count")).toHaveTextContent("1");
  fireEvent.click(screen.getByText("Mark"));
  await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  expect(readCachedResource("intakes:2026-10-14")).toEqual([]);
  view.rerender(
    <MemoryRouter>
      <Probe date="2026-10-15" />
    </MemoryRouter>,
  );
  expect(screen.getByTestId("loading")).toHaveTextContent("false");
  expect(screen.getByTestId("count")).toHaveTextContent("0");
});
