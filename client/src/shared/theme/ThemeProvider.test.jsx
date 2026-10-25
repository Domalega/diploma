import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from "./ThemeProvider";
import ThemeSwitcher from "./ThemeSwitcher";
import ColorSwitcher from "./ColorSwitcher";
import { COLOR_PALETTES, COLOR_STORAGE_KEY } from "./palettes";
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
const select = (value) =>
  fireEvent.click(
    screen.getByRole("radio", { name: { system: "System", light: "Light", dark: "Dark" }[value] }),
  );

test("the default follows the system and reacts to changes without saving an override", () => {
  mount();
  expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
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
  expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
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

test("Android system bars receive the resolved theme on startup, manual changes and system changes", () => {
  const postMessage = jest.fn();
  window.DaymarkAppearance = { postMessage };
  try {
    mount();
    expect(postMessage).toHaveBeenLastCalledWith(JSON.stringify({ theme: "dark" }));
    select("light");
    expect(postMessage).toHaveBeenLastCalledWith(JSON.stringify({ theme: "light" }));
    systemChange(false);
    systemChange(true);
    expect(postMessage).toHaveBeenLastCalledWith(JSON.stringify({ theme: "light" }));
    select("system");
    expect(postMessage).toHaveBeenLastCalledWith(JSON.stringify({ theme: "dark" }));
    systemChange(false);
    expect(postMessage).toHaveBeenLastCalledWith(JSON.stringify({ theme: "light" }));
  } finally {
    delete window.DaymarkAppearance;
  }
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
  expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "invalid",
        storageArea: localStorage,
      }),
    ),
  );
  expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
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
  expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
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

test("auth and calendar settings share a theme preference without a control in the calendar header", async () => {
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
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(
    within(within(dialog).getByRole("group", { name: "Theme" })).getAllByRole("radio"),
  ).toHaveLength(3);
  select("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  select("dark");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("link", { name: "Back to login" }));
  expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
});

test("listeners are removed when the provider unmounts", () => {
  const view = mount();
  expect(listeners.size).toBe(1);
  view.unmount();
  expect(listeners.size).toBe(0);
});

function colorControls() {
  return render(
    <ThemeProvider>
      <Probe />
      <ColorSwitcher />
    </ThemeProvider>,
  );
}

test.each(COLOR_PALETTES)(
  "$label works with light, dark and system mode and survives reopening",
  ({ value, label }) => {
    const view = colorControls();
    if (value === "green") fireEvent.click(screen.getByRole("radio", { name: "Blue" }));
    fireEvent.click(screen.getByRole("radio", { name: label }));
    expect(document.documentElement.dataset.color).toBe(value);
    expect(localStorage.getItem(COLOR_STORAGE_KEY)).toBe(value);
    select("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.color).toBe(value);
    select("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.color).toBe(value);
    select("system");
    systemChange(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.color).toBe(value);
    view.unmount();
    colorControls();
    expect(screen.getByRole("radio", { name: label })).toBeChecked();
    expect(document.documentElement.dataset.color).toBe(value);
  },
);

test("palette changes synchronize across tabs, ignore other storage and reset safely", () => {
  colorControls();
  const change = (value, storageArea = localStorage) =>
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: COLOR_STORAGE_KEY,
          newValue: value,
          storageArea,
        }),
      ),
    );
  change("blue");
  expect(screen.getByRole("radio", { name: "Blue" })).toBeChecked();
  change("purple", sessionStorage);
  expect(screen.getByRole("radio", { name: "Blue" })).toBeChecked();
  change("invalid");
  expect(screen.getByRole("radio", { name: "Green" })).toBeChecked();
  change("monochrome");
  act(() =>
    window.dispatchEvent(new StorageEvent("storage", { key: null, storageArea: localStorage })),
  );
  expect(screen.getByRole("radio", { name: "Green" })).toBeChecked();
});

test("the settings palette updates the calendar and remains selected after closing settings", async () => {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <NavBar dates={[]} />
      </MemoryRouter>
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const dialog = await screen.findByRole("dialog");
  const colors = within(dialog).getByRole("group", { name: "Color palette" });
  expect(within(colors).getAllByRole("radio")).toHaveLength(COLOR_PALETTES.length);
  fireEvent.click(within(colors).getByRole("radio", { name: "Black & white" }));
  expect(document.documentElement.dataset.color).toBe("monochrome");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(await screen.findByRole("radio", { name: "Black & white" })).toBeChecked();
});

test("restricted storage still permits switching palettes", () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  colorControls();
  fireEvent.click(screen.getByRole("radio", { name: "Purple" }));
  expect(document.documentElement.dataset.color).toBe("purple");
});
