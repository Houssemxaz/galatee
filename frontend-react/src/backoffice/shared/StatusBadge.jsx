import { Badge } from "@/components/ui/badge";

const LABELS = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

export default function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={`bo-status-${status}`}>
      <span className="bo-status-dot" aria-hidden="true" />
      {LABELS[status] || status}
    </Badge>
  );
}
