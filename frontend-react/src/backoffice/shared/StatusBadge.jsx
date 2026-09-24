const STATUS_MAP = {
  draft: { label: "Brouillon", tone: "warn" },
  published: { label: "Publié", tone: "ok" },
  archived: { label: "Archivé", tone: "muted" },
};

export default function StatusBadge({ status }) {
  const meta = STATUS_MAP[status] || { label: status, tone: "muted" };
  return <span className={`bo-status bo-status-${meta.tone}`}>{meta.label}</span>;
}
