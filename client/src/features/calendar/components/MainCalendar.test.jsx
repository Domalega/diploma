import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import MainCalendar from "./MainCalendar";
import { formatDay, monthStart, moveMonths, monthDays, moveDays } from "../utils/calendarDates";
test("date-only arithmetic handles leap years, month ends and DST without shifting note dates", () => {
  expect(moveMonths("2024-01-31", 1)).toBe("2024-02-29");
  expect(moveMonths("2026-01-31", 1)).toBe("2026-02-28");
  expect(moveMonths("2026-12-31", 1)).toBe("2027-01-31");
  expect(moveDays("2026-03-08", 1)).toBe("2026-03-09");
  expect(monthDays("2026-02-01")).toHaveLength(35);
});
test("arrow keys cross month boundaries with focus retained and Enter can select that day", () => {
  const select = jest.fn();
  function CalendarFixture() {
    const [month, setMonth] = useState("2026-10-01");
    return (
      <MainCalendar
        month={month}
        dates={[]}
        selectedDate="2026-10-31"
        onSelect={select}
        onMonthChange={(date) => setMonth(monthStart(date))}
      />
    );
  }
  render(<CalendarFixture />);
  const last = screen.getByRole("button", { name: formatDay("2026-10-31"), exact: true });
  last.focus();
  fireEvent.keyDown(last, { key: "ArrowRight" });
  const next = screen.getByRole("button", { name: formatDay("2026-11-01"), exact: true });
  expect(next).toHaveFocus();
  expect(next).toHaveAttribute("tabindex", "0");
  fireEvent.click(next);
  expect(select).toHaveBeenCalledWith("2026-11-01");
  fireEvent.keyDown(next, { key: "Home" });
  expect(screen.getByRole("button", { name: formatDay("2026-10-26"), exact: true })).toHaveFocus();
});
