import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, X, Check } from "lucide-react";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function toIso(date) {
  return date.toISOString().slice(0, 10);
}
function fromIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatDate(iso) {
  if (!iso) return "";
  return fromIso(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function startOfWeek(date) {
  const day = (date.getDay() + 6) % 7;
  const result = new Date(date);
  result.setDate(result.getDate() - day);
  return result;
}

export const PRESETS = {
  today: (today) => ({ from: toIso(today), to: toIso(today) }),
  week: (today) => ({ from: toIso(startOfWeek(today)), to: toIso(today) }),
  month: (today) => ({ from: toIso(new Date(today.getFullYear(), today.getMonth(), 1)), to: toIso(today) }),
  year: (today) => ({ from: toIso(new Date(today.getFullYear(), 0, 1)), to: toIso(today) }),
};

const PRESET_LABELS = [
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "year", label: "Cette année" },
];

const GROUP_OPTIONS = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "year", label: "Année" },
];

export function defaultRange() {
  return PRESETS.month(new Date());
}

function detectPreset(range) {
  const today = new Date();
  for (const key of Object.keys(PRESETS)) {
    const preset = PRESETS[key](today);
    if (preset.from === range.from && preset.to === range.to) return key;
  }
  return "custom";
}

export default function DateRangeFilter({ range, onRangeChange, groupBy, onGroupByChange }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [draft, setDraft] = useState({ from: fromIso(range.from), to: fromIso(range.to) });
  const activePreset = useMemo(() => detectPreset(range), [range]);

  // Reset le brouillon a chaque ouverture avec la selection courante.
  useEffect(() => {
    if (popoverOpen) setDraft({ from: fromIso(range.from), to: fromIso(range.to) });
  }, [popoverOpen, range]);

  function selectPreset(key) {
    onRangeChange(PRESETS[key](new Date()));
  }

  function handleCalendarSelect(nextRange) {
    setDraft(nextRange || { from: null, to: null });
  }

  function confirmRange() {
    if (!draft?.from) return;
    const from = toIso(draft.from);
    const to = toIso(draft.to || draft.from);
    onRangeChange({ from, to });
    setPopoverOpen(false);
  }

  function clearRange() {
    setDraft({ from: null, to: null });
  }

  const draftLabel = draft?.from
    ? draft.to && draft.to !== draft.from
      ? `${draft.from.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} → ${draft.to.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`
      : draft.from.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "Choisir une plage…";

  return (
    <div className="bo-daterange">
      <div className="bo-daterange-presets" role="group" aria-label="Période">
        {PRESET_LABELS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`bo-daterange-pill ${activePreset === preset.key ? "is-active" : ""}`}
            onClick={() => selectPreset(preset.key)}
          >
            {preset.label}
          </button>
        ))}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`bo-daterange-pill bo-daterange-custom ${activePreset === "custom" ? "is-active" : ""}`}
            >
              <CalendarIcon size={13} strokeWidth={1.8} />
              <span>
                {activePreset === "custom"
                  ? `${formatDate(range.from)} — ${formatDate(range.to)}`
                  : "Personnalisé"}
              </span>
              <ChevronDown size={12} strokeWidth={1.8} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="bo-daterange-popover-content">
            <div className="bo-cal-head">
              <div className="bo-cal-head-info">
                <p className="bo-cal-head-eyebrow">Plage sélectionnée</p>
                <p className="bo-cal-head-value">{draftLabel}</p>
              </div>
              {draft?.from && (
                <button type="button" className="bo-cal-head-clear" onClick={clearRange} aria-label="Effacer">
                  <X size={13} strokeWidth={2} />
                </button>
              )}
            </div>
            <Calendar
              mode="range"
              selected={draft}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              locale={fr}
              defaultMonth={draft?.from || new Date()}
              className="bo-cal"
              classNames={{
                months: "bo-cal-months",
                month: "bo-cal-month",
                caption: "bo-cal-caption",
                caption_label: "bo-cal-caption-label",
                nav: "bo-cal-nav",
                nav_button: "bo-cal-nav-btn",
                nav_button_previous: "bo-cal-nav-prev",
                nav_button_next: "bo-cal-nav-next",
                table: "bo-cal-table",
                head_row: "bo-cal-head-row",
                head_cell: "bo-cal-head-cell",
                row: "bo-cal-row",
                cell: "bo-cal-cell",
                day: "bo-cal-day",
                day_selected: "bo-cal-day-selected",
                day_today: "bo-cal-day-today",
                day_outside: "bo-cal-day-outside",
                day_disabled: "bo-cal-day-disabled",
                day_range_start: "bo-cal-day-range-start",
                day_range_end: "bo-cal-day-range-end",
                day_range_middle: "bo-cal-day-range-middle",
                day_hidden: "bo-cal-day-hidden",
              }}
            />
            <div className="bo-cal-footer">
              <button type="button" className="bo-cal-btn bo-cal-btn-ghost" onClick={() => setPopoverOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="bo-cal-btn bo-cal-btn-primary"
                onClick={confirmRange}
                disabled={!draft?.from}
              >
                <Check size={14} strokeWidth={2.2} />
                <span>Appliquer</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="bo-daterange-groupby">
        <span className="bo-daterange-groupby-label">Grouper par</span>
        <Select value={groupBy} onValueChange={onGroupByChange}>
          <SelectTrigger className="bo-select-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
