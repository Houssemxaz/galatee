import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toIso(date) {
  return date.toISOString().slice(0, 10);
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
  { key: "custom", label: "Personnalisé" },
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

export default function DateRangeFilter({ range, onRangeChange, groupBy, onGroupByChange }) {
  const [activePreset, setActivePreset] = useState("month");
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);

  function selectPreset(key) {
    setActivePreset(key);
    if (key === "custom") return;
    onRangeChange(PRESETS[key](new Date()));
  }

  function applyCustom(event) {
    event.preventDefault();
    onRangeChange({ from: customFrom, to: customTo });
  }

  return (
    <div className="bo-filter-bar">
      <div className="bo-filter-presets" role="group" aria-label="Période">
        {PRESET_LABELS.map((preset) => (
          <Button
            key={preset.key}
            type="button"
            variant={activePreset === preset.key ? "default" : "outline"}
            size="sm"
            onClick={() => selectPreset(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {activePreset === "custom" && (
        <form className="bo-filter-custom" onSubmit={applyCustom}>
          <Label htmlFor="drf-from">Du</Label>
          <Input id="drf-from" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
          <Label htmlFor="drf-to">Au</Label>
          <Input id="drf-to" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
          <Button type="submit" size="sm">Appliquer</Button>
        </form>
      )}
      <div className="bo-filter-group">
        <Label htmlFor="drf-groupby">Grouper par</Label>
        <select id="drf-groupby" className="bo-native-select" value={groupBy} onChange={(event) => onGroupByChange(event.target.value)}>
          {GROUP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
