import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from "./ThemeProvider";
import ThemeSwitcher from "./ThemeSwitcher";
import AuthLayout from "../../features/auth/components/AuthLayout";
import NavBar from "../../features/calendar/components/NavBar";

let listeners, query;
beforeEach(() => {
  localStorage.clear();
  listeners = new Set();
  query = {
    matches: true,
    addEventListener: jest.fn((name, listener) => listeners.add(listener)),
    removeEventListener: jest.fn((name, listener) => listeners.delete(listener)),
  };
  jest
    .spyOn(window, "matchMedia")
    .mockImplementation((media) =>
      media === "(prefers-color-scheme: dark)"
        ? query
        : { matches: false, media, addListener() {}, removeListener() {} },
    );
});
afterEach(() => jest.restoreAllMocks());
function systemChange(dark) {
  act(() => {
    query.matches = dark;
    listeners.forEach((listener) => listener({ matches: dark }));
  });
}
function Probe() {
  const { preference, resolvedTheme } = useTheme();
  return (
    <>
      <ThemeSwitcher />
      <p data-testid="theme-state">
        {preference}:{resolvedTheme}
      </p>
    </>
  );
}
function mount() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}
const select = (value) => fireEvent.change(screen.getByLabelText("Theme"), { target: { value } });

test("the default follows the system and reacts to changes without saving an override", () => {
  mount();
  expect(screen.getByLabelText("Theme")).toHaveValue("system");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  systemChange(false);
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
});

test("a manual preference survives remounting and takes priority over the device", () => {
  const view = mount();
  select("light");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  systemChange(false);
  systemChange(true);
  expect(document.documentElement.dataset.theme).toBe("light");
  view.unmount();
  mount();
  expect(screen.getByLabelText("Theme")).toHaveValue("light");
  expect(document.documentElement.dataset.theme).toBe("light");
});

test("returning to System immediately resumes the latest device preference", () => {
  mount();
  select("dark");
  systemChange(false);
  expect(document.documentElement.dataset.theme).toBe("dark");
  select("system");
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  systemChange(true);
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("theme preferences synchronize across tabs and invalid values fall back to System", () => {
  mount();
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "light",
        storageArea: localStorage,
      }),
    ),
  );
  expect(screen.getByLabelText("Theme")).toHaveValue("light");
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "invalid",
        storageArea: localStorage,
      }),
    ),
  );
  expect(screen.getByLabelText("Theme")).toHaveValue("system");
  expect(document.documentElement.dataset.theme).toBe("dark");
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "light",
        storageArea: sessionStorage,
      }),
    ),
  );
  expect(screen.getByLabelText("Theme")).toHaveValue("system");
});

test("restricted browser storage does not break rendering or switching themes", () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  mount();
  expect(document.documentElement.dataset.theme).toBe("dark");
  select("light");
  expect(document.documentElement.dataset.theme).toBe("light");
});

test("auth, calendar and the profile menu share the same preference across navigation", async () => {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthLayout>
                <Link to="/calendar">Open calendar</Link>
              </AuthLayout>
            }
          />
          <Route
            path="/calendar"
            element={
              <>
                <NavBar dates={[]} onDelete={() => {}} />
                <Link to="/login">Back to login</Link>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
  select("dark");
  fireEvent.click(screen.getByRole("link", { name: "Open calendar" }));
  expect(screen.getByLabelText("Theme")).toHaveValue("dark");
  select("light");
  fireEvent.click(screen.getByRole("button", { name: "Account" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("combobox", { name: "Theme" })).toHaveValue("light");
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Theme" }), {
    target: { value: "dark" },
  });
  expect(document.documentElement.dataset.theme).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("link", { name: "Back to login" }));
  expect(screen.getByLabelText("Theme")).toHaveValue("dark");
});

test("listeners are removed when the provider unmounts", () => {
  const view = mount();
  expect(listeners.size).toBe(1);
  view.unmount();
  expect(listeners.size).toBe(0);
});
