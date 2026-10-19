import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TaskHistory from "./TaskHistory";
import { getHistory } from "../api/kanbanApi";
jest.mock("../api/kanbanApi");
const event = (id) => ({
  id,
  kind: "edited",
  details: { title: "Edit " + id },
  createdAt: "2026-10-19T08:00:00Z",
});
beforeEach(() => jest.resetAllMocks());

test("activity is fetched only after expanding and older pages append with their cursor", async () => {
  getHistory
    .mockResolvedValueOnce({ events: [event(8), event(7)], nextCursor: 7 })
    .mockResolvedValueOnce({ events: [event(6)], nextCursor: null });
  render(<TaskHistory taskId="task" columns={[]} />);
  expect(getHistory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Task history"));
  const more = await screen.findByRole("button", { name: "Load more activity" });
  expect(getHistory).toHaveBeenCalledWith("task", expect.any(AbortSignal), null);
  expect(screen.getAllByText("Edited")).toHaveLength(2);
  fireEvent.click(more);
  await waitFor(() => expect(screen.getAllByText("Edited")).toHaveLength(3));
  expect(getHistory).toHaveBeenLastCalledWith("task", expect.any(AbortSignal), 7);
  expect(screen.queryByRole("button", { name: "Load more activity" })).not.toBeInTheDocument();
});

test("failed pages preserve loaded activity and offline pages are labelled as saved copies", async () => {
  getHistory
    .mockResolvedValueOnce({ events: [event(8)], nextCursor: 8 })
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ events: [event(7)], nextCursor: null, offline: true });
  render(<TaskHistory taskId="task" columns={[]} />);
  fireEvent.click(screen.getByText("Task history"));
  fireEvent.click(await screen.findByRole("button", { name: "Load more activity" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  expect(screen.getAllByText("Edited")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(
    await screen.findByText("Showing saved activity. Connect to load the latest history."),
  ).toBeInTheDocument();
  expect(screen.getAllByText("Edited")).toHaveLength(2);
});

test("unmounting cancels the request and ignores a late reply", async () => {
  let finish;
  getHistory.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<TaskHistory taskId="task" columns={[]} />);
  fireEvent.click(screen.getByText("Task history"));
  await waitFor(() => expect(getHistory).toHaveBeenCalledTimes(1));
  const signal = getHistory.mock.calls[0][1];
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ events: [event(1)], nextCursor: null }));
});
