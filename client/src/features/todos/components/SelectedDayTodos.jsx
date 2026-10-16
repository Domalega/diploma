import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { TodoRow } from "./TodoTile";

export default function SelectedDayTodos({ tracker, date, onSelectDate }) {
  const { t } = useLanguage();
  const tasks = tracker.list.enabled ? tracker.list.tasks.filter((task) => task.date === date) : [];
  if (!tasks.length) return null;
  return (
    <section className="selected-day-todos" aria-label={t("To-do list for selected day")}>
      <h3>{t("To-do list")}</h3>
      <ul>
        {tasks.map((task) => (
          <TodoRow
            key={task.id}
            task={task}
            busy={tracker.loading || tracker.pending || tracker.conflict}
            send={tracker.send}
            onSelectDate={onSelectDate}
          />
        ))}
      </ul>
    </section>
  );
}
