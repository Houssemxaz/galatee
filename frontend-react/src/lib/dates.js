export function dateToIso(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
export function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
export function formatDateDisplay(value) {
  const date = parseIsoDate(value);
  return date ? `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}` : "";
}
export function formatDateDraft(value) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (/^\d{4}[-/]?/.test(raw)) {
    const year = digits.slice(0, 4); const month = digits.slice(4, 6); const day = digits.slice(6, 8);
    return [day, month, year].filter(Boolean).join("/");
  }
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
export function parseDateDraft(value) {
  const displayMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (displayMatch) return `${displayMatch[3]}-${displayMatch[2]}-${displayMatch[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}
export function isSelectableDate(value, min) {
  const date = parseIsoDate(value);
  return Boolean(date && (!min || value >= min));
}
export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
export function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}
export function formatLongDate(value) {
  const date = parseIsoDate(value);
  return date ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date) : "";
}
export function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return dateToIso(date);
}
export function getNextServiceDate() {
  const date = new Date();
  for (let offset = 1; offset <= 7; offset += 1) {
    date.setDate(date.getDate() + 1);
    if ([3, 4, 5, 6].includes(date.getDay())) return dateToIso(date);
  }
  return getTomorrow();
}
