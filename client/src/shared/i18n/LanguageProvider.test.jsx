import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider, LANGUAGE_KEY, systemLanguage, useLanguage } from "./LanguageProvider";
import LanguageSwitcher from "./LanguageSwitcher";
import { translate } from "./messages";
import { ThemeProvider } from "../theme/ThemeProvider";
import AuthLayout from "../../features/auth/components/AuthLayout";
import AuthForm from "../../features/auth/components/AuthForm";

let originalLanguages;
beforeEach(() => {
  originalLanguages = Object.getOwnPropertyDescriptor(navigator, "languages");
  Object.defineProperty(navigator, "languages", { configurable: true, value: ["ru-RU", "en-US"] });
  localStorage.clear();
});
afterEach(() => {
  if (originalLanguages) Object.defineProperty(navigator, "languages", originalLanguages);
  else delete navigator.languages;
  document.documentElement.lang = "en";
});
function Probe() {
  const { locale, t } = useLanguage();
  return (
    <>
      <LanguageSwitcher />
      <p data-testid="locale">{locale}</p>
      <p>{t("Settings")}</p>
    </>
  );
}
test("system is the default, explicit selection persists and language changes only affect system mode", () => {
  let view = render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  );
  expect(screen.getByRole("radio", { name: "Системный" })).toBeChecked();
  expect(screen.getByTestId("locale")).toHaveTextContent("ru");
  expect(document.documentElement.lang).toBe("ru");
  fireEvent.click(screen.getByRole("radio", { name: "English" }));
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe("en");
  expect(screen.getByText("Settings")).toBeInTheDocument();
  view.unmount();
  view = render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  );
  expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
  act(() => window.dispatchEvent(new Event("languagechange")));
  expect(screen.getByTestId("locale")).toHaveTextContent("en");
  fireEvent.click(screen.getByRole("radio", { name: "System language" }));
  expect(screen.getByTestId("locale")).toHaveTextContent("ru");
  Object.defineProperty(navigator, "languages", { configurable: true, value: ["de-DE"] });
  act(() => window.dispatchEvent(new Event("languagechange")));
  expect(screen.getByTestId("locale")).toHaveTextContent("en");
});
test("invalid preferences fall back to system and changes from another tab are applied", () => {
  localStorage.setItem(LANGUAGE_KEY, "invalid");
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  );
  expect(screen.getByTestId("locale")).toHaveTextContent("ru");
  localStorage.setItem(LANGUAGE_KEY, "en");
  act(() =>
    window.dispatchEvent(new StorageEvent("storage", { key: LANGUAGE_KEY, newValue: "en" })),
  );
  expect(screen.getByTestId("locale")).toHaveTextContent("en");
  localStorage.removeItem(LANGUAGE_KEY);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: null })));
  expect(screen.getByTestId("locale")).toHaveTextContent("ru");
  expect(systemLanguage(["fr-FR", "en-GB"])).toBe("en");
  expect(systemLanguage([], "ru-RU")).toBe("ru");
});
test("language switching translates authentication without clearing input or changing the theme or layout", () => {
  localStorage.setItem("calendar.theme", "dark");
  localStorage.setItem("daymark.panel-layout.v1", '["medications","calendar","today","notes"]');
  render(
    <LanguageProvider>
      <ThemeProvider>
        <MemoryRouter>
          <AuthLayout>
            <AuthForm mode="login" onSubmit={() => {}} />
          </AuthLayout>
        </MemoryRouter>
      </ThemeProvider>
    </LanguageProvider>,
  );
  fireEvent.change(screen.getByLabelText("Электронная почта"), {
    target: { value: "demo@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Пароль", { exact: true }), {
    target: { value: "unchanged draft" },
  });
  fireEvent.click(screen.getByRole("radio", { name: "English" }));
  expect(screen.getByLabelText("Email address")).toHaveValue("demo@example.com");
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("unchanged draft");
  fireEvent.click(screen.getByRole("radio", { name: "Русский" }));
  fireEvent.click(screen.getByRole("button", { name: "Показать: пароль" }));
  expect(screen.getByLabelText("Пароль", { exact: true })).toHaveAttribute("type", "text");
  expect(
    within(screen.getByRole("group", { name: "Тема" })).getByRole("radio", { name: "Тёмная" }),
  ).toBeChecked();
  expect(localStorage.getItem("calendar.theme")).toBe("dark");
  expect(localStorage.getItem("daymark.panel-layout.v1")).toBe(
    '["medications","calendar","today","notes"]',
  );
});
test("Russian counters use the correct forms and named placeholders preserve user text", () => {
  expect(
    [0, 1, 2, 5, 11, 21, 22].map((count) => translate("notes.count", "ru", { count })),
  ).toEqual([
    "0 заметок",
    "1 заметка",
    "2 заметки",
    "5 заметок",
    "11 заметок",
    "21 заметка",
    "22 заметки",
  ]);
  expect(translate("Edit medication {name}", "ru", { name: "Settings" })).toBe(
    "Изменить препарат «Settings»",
  );
  expect(translate("notes.found", "en", { count: 2 })).toBe("2 notes found");
});
