import { useLanguage } from "../i18n/LanguageProvider";
import { useEffect, useRef, useState } from "react";
import { FiStar } from "react-icons/fi";
import "../styles/InteractivePhrase.css";

const phrases = [
  "One day at a time.",
  "Make room for what matters.",
  "Small steps count.",
  "A little pause can help.",
  "Your plans. Your pace.",
  "Leave a little space for yourself.",
];
const sparks = [
  [-66, -24],
  [-38, -44],
  [0, -50],
  [38, -40],
  [68, -12],
  [50, 25],
  [-42, 30],
  [-72, 8],
];
export default function InteractivePhrase() {
  const { t } = useLanguage();

  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const pause = useRef({ hover: false, focus: false });
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && !pause.current.hover && !pause.current.focus)
        setIndex((value) => (value + 1) % phrases.length);
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(0), 900);
    return () => window.clearTimeout(timer);
  }, [burst]);
  function surprise() {
    const next = (index + 1) % phrases.length;
    setIndex(next);
    setAnnouncement(phrases[next]);
    setBurst((value) => value + 1);
  }
  return (
    <div className="interactive-phrase">
      <button
        type="button"
        className="phrase-button"
        title={t("Click for a new thought")}
        aria-label={t("{phrase} Show another thought.", { phrase: t(phrases[index]) })}
        onClick={surprise}
        onMouseEnter={() => {
          pause.current.hover = true;
        }}
        onMouseLeave={() => {
          pause.current.hover = false;
        }}
        onFocus={() => {
          pause.current.focus = true;
        }}
        onBlur={() => {
          pause.current.focus = false;
        }}
      >
        <FiStar aria-hidden="true" />
        <span key={"phrase-" + index} className="phrase-text">
          {t(phrases[index])}
        </span>
        {!!burst && (
          <span key={"burst-" + burst} className="phrase-sparks" aria-hidden="true">
            {sparks.map(([x, y], id) => (
              <FiStar
                key={id}
                style={{
                  "--spark-x": x + "px",
                  "--spark-y": y + "px",
                  "--spark-delay": id * 12 + "ms",
                }}
              />
            ))}
          </span>
        )}
      </button>
      <span className="visually-hidden" role="status" aria-label={t("Phrase update")}>
        {t(announcement)}
      </span>
    </div>
  );
}
