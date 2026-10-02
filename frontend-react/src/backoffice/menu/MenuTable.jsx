import { useMemo, useState } from "react";
import { LayoutGrid, Eye, Package, PenLine, PackageX, Archive, Send, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "../shared/StatusBadge.jsx";
import { SortableTh, EmptyState } from "../shared/primitives.jsx";

const TYPE_LABELS = { dish: "Plat", menu: "Menu", offer: "Offre" };
const CATEGORY_LABELS = { fresca: "Pasta fresca", ripiena: "Pasta ripiena", vegetal: "Végétarien", dolci: "Dolci" };

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function MenuTable({ items, onEdit, onPreview, onPublish, onArchive, onRestore, onAvailability, availabilityId, archivingId }) {
  const [sortKey, setSortKey] = useState("sortOrder");
  const [sortDir, setSortDir] = useState("asc");

  const sorted = useMemo(() => {
    const list = [...items];
    const sign = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "title": av = a.current?.title || ""; bv = b.current?.title || ""; break;
        case "category": av = a.category || ""; bv = b.category || ""; break;
        case "status": av = a.status || ""; bv = b.status || ""; break;
        case "updated": av = a.updatedAt || ""; bv = b.updatedAt || ""; break;
        case "sortOrder":
        default: av = a.sortOrder || 0; bv = b.sortOrder || 0;
      }
      if (typeof av === "string") return av.localeCompare(bv, "fr") * sign;
      return (av - bv) * sign;
    });
    return list;
  }, [items, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Aucun élément"
        description="Créez le premier plat, menu ou offre pour votre carte."
      />
    );
  }

  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <thead>
          <tr>
            <SortableTh sortKey="title" activeKey={sortKey} direction={sortDir} onSort={toggleSort}>Élément</SortableTh>
            <SortableTh sortKey="category" activeKey={sortKey} direction={sortDir} onSort={toggleSort}>Catégorie</SortableTh>
            <SortableTh sortKey="status" activeKey={sortKey} direction={sortDir} onSort={toggleSort}>Statut</SortableTh>
            <th>Dispo</th>
            <SortableTh sortKey="sortOrder" activeKey={sortKey} direction={sortDir} onSort={toggleSort}>Ordre</SortableTh>
            <SortableTh sortKey="updated" activeKey={sortKey} direction={sortDir} onSort={toggleSort}>Mis à jour</SortableTh>
            <th className="bo-th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const current = item.current;
            const hasUnpublished = item.status === "draft" || (item.draft && item.published && item.draft.id !== item.published.id);
            return (
              <tr key={item.id}>
                <td>
                  <div className="bo-menu-cell">
                    {current?.imageUrl ? (
                      <img src={current.imageUrl} alt="" className="bo-menu-thumb" loading="lazy" />
                    ) : (
                      <div className="bo-menu-thumb bo-menu-thumb-empty" aria-hidden="true">
                        <Package size={16} strokeWidth={1.6} />
                      </div>
                    )}
                    <div className="bo-menu-cell-body">
                      <span className="bo-menu-type">{TYPE_LABELS[item.productType] || "Plat"}</span>
                      <p className="bo-menu-title">{current?.title || "(sans titre)"}</p>
                      {hasUnpublished && item.status !== "archived" && (
                        <span className="bo-menu-unpublished">
                          <span />
                          Modifications non publiées
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="bo-menu-cat">{CATEGORY_LABELS[item.category] || item.category}</td>
                <td><StatusBadge status={item.status} /></td>
                <td>
                  <span className={`bo-status ${item.available ? "bo-status-ok" : "bo-status-err"}`}>
                    {item.available ? "Dispo" : "Rupture"}
                  </span>
                </td>
                <td className="bo-td-num">{item.sortOrder}</td>
                <td className="bo-td-num" style={{ color: "var(--bo-ink-soft)" }}>{formatDate(item.updatedAt)}</td>
                <td className="bo-td-actions">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(item)} aria-label="Modifier">
                    <PenLine size={13} strokeWidth={1.8} />
                    <span>Modifier</span>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onPreview(item)} aria-label="Aperçu">
                    <Eye size={13} strokeWidth={1.8} />
                  </Button>
                  {item.status !== "archived" && hasUnpublished && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onPublish(item)} aria-label="Publier">
                      <Send size={13} strokeWidth={1.8} />
                    </Button>
                  )}
                  {item.status !== "archived" && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onAvailability(item)} disabled={availabilityId === item.id} aria-label={item.available ? "Rupture" : "Rendre dispo"}>
                      <PackageX size={13} strokeWidth={1.8} />
                    </Button>
                  )}
                  {item.status !== "archived" && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onArchive(item)} aria-label="Archiver">
                      {archivingId === item.id ? "Confirmer ?" : <Archive size={13} strokeWidth={1.8} />}
                    </Button>
                  )}
                  {item.status === "archived" && onRestore && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onRestore(item)} aria-label="Restaurer en brouillon">
                      <ArchiveRestore size={13} strokeWidth={1.8} />
                      <span>Restaurer</span>
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
