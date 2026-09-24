import { useRef } from "react";

const DEFAULT_WORDS = [
  "Pasta. Music. Memories.",
  "Hydra, Alger",
  "Pâtes fraîches maison",
  "Ouvert Mer — Sam · dès 19h",
];

const RESUME_DELAY = 500;

export default function BrandMarquee({ words = DEFAULT_WORDS, tone = "olive" }) {
  const line = [...words, ...words, ...words, ...words];
  const ref = useRef(null);
  const timerRef = useRef(null);

  const scheduleResume = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      ref.current?.classList.remove("is-paused");
    }, RESUME_DELAY);
  };

  const pause = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    ref.current?.classList.add("is-paused");
  };

  return (
    <div
      ref={ref}
      className={`brand-marquee brand-marquee-${tone}`}
      role="marquee"
      aria-hidden="true"
      onPointerDown={pause}
      onPointerUp={scheduleResume}
      onPointerLeave={scheduleResume}
      onTouchEnd={scheduleResume}
      onTouchCancel={scheduleResume}
    >
      <div className="brand-marquee-track">
        {line.map((word, i) => (
          <span className="brand-marquee-item" key={i}>
            <span>{word}</span>
            <i className="brand-marquee-dot" aria-hidden="true">✱</i>
          </span>
        ))}
      </div>
    </div>
  );
}
