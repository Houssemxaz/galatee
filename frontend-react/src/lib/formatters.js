export function formatDzd(cents) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`;
}
