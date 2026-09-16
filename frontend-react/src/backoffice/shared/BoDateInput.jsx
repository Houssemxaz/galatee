import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  dateToIso,
  parseIsoDate,
  formatDateDisplay,
  formatDateDraft,
  parseDateDraft,
  startOfMonth,
  formatMonthLabel,
} from "@/lib/dates";

const WEEKDAYS = ["lu", "ma", "me", "je", "ve", "sa", "di"];

function buildGrid(anchor) {
  const first = startOfMonth(anchor);
  // Monday = start (0 = Monday, 6 = Sunday)
  const startOffset = (first.getDay() + 6) % 7;
  const days = [];
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - startOffset);
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function BoDateInput({
  value,
  onChange,
  placeholder = "JJ/MM/AAAA",
  min,
  clearable = true,
  className = "",
}) {
  const [draft, setDraft] = useState(formatDateDisplay(value));
  const [open, setOpen] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState(() => parseIsoDate(value) || new Date());
  const rootRef = useRef(null);

  useEffect(() => {
    setDraft(formatDateDisplay(value));
    const parsed = parseIsoDate(value);
    if (parsed) setMonthAnchor(parsed);
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commitDraft(text) {
    const iso = parseDateDraft(text);
    if (iso && (!min || iso >= min)) onChange(iso);
    else if (!text.trim()) onChange("");
  }

  function pick(day) {
    const iso = dateToIso(day);
    if (min && iso < min) return;
    onChange(iso);
    setDraft(formatDateDisplay(iso));
    setOpen(false);
  }

  const days = useMemo(() => buildGrid(monthAnchor), [monthAnchor]);
  const currentMonth = monthAnchor.getMonth();
  const today = dateToIso(new Date());
  const monthLabel = formatMonthLabel(monthAnchor);
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return (
    <div className={`bo-date ${className}`} ref={rootRef}>
      <div className="bo-date-field">
        <input
          type="text"
          inputMode="numeric"
          className="bo-date-input"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => {
            const formatted = formatDateDraft(e.target.value);
            setDraft(formatted);
            const iso = parseDateDraft(formatted);
            if (iso && iso.length === 10 && (!min || iso >= min)) onChange(iso);
          }}
          onBlur={() => commitDraft(draft)}
          onFocus={(e) => e.target.select()}
        />
        {clearable && value && (
          <button
            type="button"
            className="bo-date-clear"
            aria-label="Effacer la date"
            onClick={() => { onChange(""); setDraft(""); }}
          >
            <X size={12} strokeWidth={2.2} />
          </button>
        )}
        <button
          type="button"
          className="bo-date-toggle"
          aria-label="Ouvrir le calendrier"
          onClick={() => setOpen((v) => !v)}
        >
          <CalendarDays size={14} strokeWidth={1.7} />
        </button>
      </div>

      {open && (
        <div className="bo-date-popover" role="dialog">
          <div className="bo-date-head">
            <button type="button" className="bo-date-nav" aria-label="Mois précédent"
              onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}>
              <ChevronLeft size={15} strokeWidth={1.8} />
            </button>
            <span className="bo-date-month">{monthLabelCap}</span>
            <button type="button" className="bo-date-nav" aria-label="Mois suivant"
              onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}>
              <ChevronRight size={15} strokeWidth={1.8} />
            </button>
          </div>

          <div className="bo-date-weekdays" aria-hidden="true">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="bo-date-grid" role="grid">
            {days.map((d) => {
              const iso = dateToIso(d);
              const isCurrentMonth = d.getMonth() === currentMonth;
              const isSelected = iso === value;
              const isToday = iso === today;
              const isDisabled = min && iso < min;
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  disabled={isDisabled}
                  className={`bo-date-cell ${!isCurrentMonth ? "is-out" : ""} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                  onClick={() => pick(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="bo-date-foot">
            <button type="button" className="bo-date-foot-link"
              onClick={() => { if (clearable) { onChange(""); setDraft(""); setOpen(false); } }}>
              Effacer
            </button>
            <button type="button" className="bo-date-foot-primary"
              onClick={() => pick(new Date())}>
              Aujourd'hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
