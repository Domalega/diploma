import { FiGrid, FiLayout, FiList } from "react-icons/fi";
import { useLanguage } from "../../../shared/i18n/LanguageProvider";

const options = [
  { value: "auto", label: "Auto", hint: "Adapt to the tile shape", Icon: FiLayout },
  { value: "table", label: "Table", hint: "Keep the table at any width", Icon: FiGrid },
  { value: "buttons", label: "Buttons", hint: "Show compact intake buttons", Icon: FiList },
];

export default function MedicationViewControl({ value, onChange }) {
  const { t } = useLanguage();
  return (
    <div className="medication-view-control" role="group" aria-label={t("Medication tracker view")}>
      {options.map(({ value: option, label, hint, Icon }) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          title={t(hint)}
          onClick={() => onChange(option)}
        >
          <Icon aria-hidden="true" />
          <span>{t(label)}</span>
        </button>
      ))}
    </div>
  );
}
