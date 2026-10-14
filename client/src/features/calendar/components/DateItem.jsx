import { useState } from "react";
import { FaTimes } from "react-icons/fa";

export default function DateItem({ date, onDelete }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function handleDelete() {
    setPending(true);
    setError("");
    try {
      await onDelete(date.date);
    } catch (error) {
      setError(error.message);
      setPending(false);
    }
  }
  return (
    <div className="profile-note">
      <div className="d-flex justify-content-between border-bottom">
        <h3 style={{ fontSize: 20 }}>{date.date}</h3>
        <button
          type="button"
          className="btn btn-sm profile-note-delete"
          disabled={pending}
          aria-label={`Delete note for ${date.date}`}
          onClick={handleDelete}
        >
          <FaTimes />
        </button>
      </div>
      <p>{date.comment}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
