import { act, fireEvent, render, screen } from "@testing-library/react";
import MatrixAddControl from "./MatrixAddControl";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function mount(props = {}) {
  const onAdd = jest.fn();
  const view = render(
    <MatrixAddControl axis="row" label="Add medication" onAdd={onAdd} {...props} />,
  );
  const button = screen.getByRole("button", { name: "Add medication" });
  // jsdom does not implement the browser's :focus-visible selector.
  jest.spyOn(button, "matches").mockReturnValue(false);
  return { ...view, onAdd, button };
}

test("brief pointer passes stay quiet, a deliberate hover reveals the action", () => {
  const { button, onAdd } = mount();
  fireEvent.pointerEnter(button);
  act(() => jest.advanceTimersByTime(400));
  expect(button).not.toHaveClass("is-revealed");
  fireEvent.pointerLeave(button);
  act(() => jest.advanceTimersByTime(1000));
  expect(button).not.toHaveClass("is-revealed");
  fireEvent.pointerEnter(button);
  act(() => jest.advanceTimersByTime(650));
  expect(button).toHaveClass("is-revealed");
  fireEvent.click(button, { detail: 1 });
  expect(onAdd).toHaveBeenCalledTimes(1);
});

test("a first tap reveals, a second activates; tapping elsewhere dismisses", () => {
  const { button, onAdd } = mount();
  fireEvent.click(button, { detail: 1 });
  expect(button).toHaveClass("is-revealed");
  expect(onAdd).not.toHaveBeenCalled();
  fireEvent.pointerDown(document.body);
  expect(button).not.toHaveClass("is-revealed");
  fireEvent.click(button, { detail: 1 });
  fireEvent.click(button, { detail: 1 });
  expect(onAdd).toHaveBeenCalledTimes(1);
});

test("keyboard focus reveals immediately, Escape hides and keyboard activation still works", () => {
  const { button, onAdd } = mount();
  jest.spyOn(button, "matches").mockReturnValue(true);
  fireEvent.focus(button);
  expect(button).toHaveClass("is-revealed");
  fireEvent.keyDown(button, { key: "Escape" });
  expect(button).not.toHaveClass("is-revealed");
  fireEvent.click(button, { detail: 0 });
  expect(onAdd).toHaveBeenCalledTimes(1);
});

test("disabling or unmounting cancels a pending reveal", () => {
  const { button, rerender, unmount } = mount();
  fireEvent.pointerEnter(button);
  rerender(<MatrixAddControl axis="row" label="Add medication" disabled onAdd={() => {}} />);
  act(() => jest.advanceTimersByTime(650));
  expect(button).not.toHaveClass("is-revealed");
  expect(button).toBeDisabled();
  rerender(<MatrixAddControl axis="row" label="Add medication" onAdd={() => {}} />);
  fireEvent.pointerEnter(button);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
