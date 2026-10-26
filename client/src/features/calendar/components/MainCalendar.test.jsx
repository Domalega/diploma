import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import MainCalendar from "./MainCalendar";
import { formatDay, monthStart, moveMonths, monthDays, moveDays } from "../utils/calendarDates";
test("date-only arithmetic handles leap years, month ends and DST without shifting note dates", () => {
  expect(moveMonths("2024-01-31", 1)).toBe("2024-02-29");
  expect(moveMonths("2026-01-31", 1)).toBe("2026-02-28");
  expect(moveMonths("2026-12-31", 1)).toBe("2027-01-31");
  expect(moveDays("2026-03-08", 1)).toBe("2026-03-09");
  expect(monthDays("2026-02-01")).toHaveLength(42);
});

test("four-, five- and six-week months keep six full weeks without losing any dates", () => {
  for (const month of ["2027-02-01", "2026-10-01", "2026-08-01"]) {
    const days = monthDays(month);
    expect(days).toHaveLength(42);
    expect(new Set(days).size).toBe(42);
    expect(new Date(days[0] + "T12:00:00").getDay()).toBe(1);
    expect(new Date(days[41] + "T12:00:00").getDay()).toBe(0);
    const last = moveDays(moveMonths(month, 1), -1);
    expect(days).toContain(month);
    expect(days).toContain(last);
  }
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
        today="2026-10-01"
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
