import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { ThemeProvider } from "../shared/theme/ThemeProvider";
import { cacheSession, readCachedResource, saveCachedResource } from "../shared/api/browserCache";
import { todayKey } from "../features/calendar/utils/calendarDates";
import { emptyPlan } from "../features/medications/utils/schedule";
import { emptyList } from "../features/todos/hooks/useTodoList";
import { emptyBoard } from "../features/kanban/hooks/useKanbanBoard";

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
});

test("the complete web screen renders saved data while auth and all API reads are delayed", async () => {
  localStorage.clear();
  const token = `header.${btoa(JSON.stringify({ id: 7 }))}.signature`;
  localStorage.setItem("token", token);
  const session = cacheSession();
  const note = { id: 1, date: todayKey(), time: null, comment: "Saved before closing the browser" };
  saveCachedResource("dates", [note], session);
  saveCachedResource("medication-plan", emptyPlan, session);
  saveCachedResource("todos", emptyList, session);
  saveCachedResource("kanban", emptyBoard, session);
  const replies = new Map();
  global.fetch = jest.fn((url) => new Promise((resolve) => replies.set(url, resolve)));
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter />
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(await screen.findByRole("table", { name: "Monthly calendar" })).toBeInTheDocument();
  expect(screen.getAllByText(note.comment).length).toBeGreaterThan(0);
  expect(screen.queryByText("Opening your calendar…")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(6);

  const refreshed = { ...note, comment: "Updated on another device" };
  await act(async () => {
    for (const [url, reply] of replies) {
      const data = url.endsWith("/user/auth")
        ? { token }
        : url.endsWith("/vault")
          ? { encrypted: false }
          : url.endsWith("/userDate/get")
            ? [refreshed]
            : url.endsWith("/todos")
              ? emptyList
              : url.endsWith("/kanban")
                ? emptyBoard
                : emptyPlan;
      reply({ ok: true, status: 200, json: async () => data });
    }
  });
  expect(screen.queryByText(note.comment)).not.toBeInTheDocument();
  expect(screen.getAllByText(refreshed.comment).length).toBeGreaterThan(0);
  expect(readCachedResource("dates")).toEqual([refreshed]);
});
