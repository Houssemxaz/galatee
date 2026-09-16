import { useEffect, useState } from "react";
import { CircleDot } from "lucide-react";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS = [
  "janv", "févr", "mars", "avril", "mai", "juin",
  "juil", "août", "sept", "oct", "nov", "déc",
];

function formatToday() {
  const d = new Date();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function isServiceEvening() {
  const day = new Date().getDay();
  return day >= 3 && day <= 6;
}

export default function Topbar({ sectionLabel }) {
  const [now, setNow] = useState(formatToday());

  useEffect(() => {
    const id = setInterval(() => setNow(formatToday()), 60_000);
    return () => clearInterval(id);
  }, []);

  const live = isServiceEvening();

  return (
    <header className="bo-topbar">
      <div className="bo-topbar-left">
        <span className="bo-topbar-crumb">Back-office</span>
        <h1 className="bo-topbar-title">{sectionLabel}</h1>
      </div>
      <div className="bo-topbar-right">
        <span className="bo-topbar-date">{now}</span>
        <span className={`bo-topbar-status ${live ? "is-live" : ""}`}>
          <CircleDot size={10} strokeWidth={2.4} aria-hidden="true" />
          {live ? "En service" : "Hors service"}
        </span>
        <button type="button" className="bo-topbar-user" aria-label="Compte administrateur">
          <span className="bo-topbar-user-label">Admin</span>
          <span className="bo-topbar-user-avatar" aria-hidden="true">G</span>
        </button>
      </div>
    </header>
  );
}
