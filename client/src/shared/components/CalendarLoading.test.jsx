import { act, render, screen } from "@testing-library/react";
import CalendarLoading from "./CalendarLoading";

test("explains a slow connection and clears its timer after loading ends", () => {
  jest.useFakeTimers();
  const { unmount } = render(<CalendarLoading fullPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Opening your calendar…");
  expect(screen.queryByText(/Still connecting/)).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(12000));
  expect(screen.getByRole("status")).toHaveTextContent("Still connecting…");
  unmount();
  render(<CalendarLoading label="Bringing your notes together…" />).unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
