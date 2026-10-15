import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function PasswordField({
  id,
  label = "Password",
  value,
  onChange,
  newPassword = false,
  hint,
}) {
  const { t } = useLanguage();

  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={id}>{t(label)}</label>
      <div className="auth-password-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={newPassword ? "new-password" : "current-password"}
          required
          minLength={newPassword ? 12 : undefined}
          placeholder={newPassword ? t("Create a strong password") : t("Enter your password")}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button
          className="auth-password-toggle"
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={t(visible ? "Hide {label}" : "Show {label}", {
            label: t(label).toLocaleLowerCase(),
          })}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
        </button>
      </div>
      {hint && (
        <p className="auth-hint" id={`${id}-hint`}>
          {t(hint)}
        </p>
      )}
    </div>
  );
}
