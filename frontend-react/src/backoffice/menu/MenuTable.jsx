import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import StatusBadge from "../shared/StatusBadge.jsx";

const TYPE_LABELS = { dish: "Plat", menu: "Menu", offer: "Offre" };

export default function MenuTable({ items, onEdit, onPreview, onPublish, onArchive, onAvailability, availabilityId, archivingId }) {
  if (!items.length) {
    return <p className="bo-empty">Aucun élément pour l'instant. Créez le premier élément du menu.</p>;
  }

  return (
    <div className="bo-table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Élément</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Commande</TableHead>
            <TableHead>Ordre</TableHead>
            <TableHead>Mis à jour</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const current = item.current;
            const hasUnpublished = item.status === "draft" || (item.draft && item.published && item.draft.id !== item.published.id);
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="bo-menu-cell">
                    {current?.imageUrl ? <img src={current.imageUrl} alt="" className="bo-menu-thumb" loading="lazy" /> : <div className="bo-menu-thumb bo-menu-thumb-empty" aria-hidden="true" />}
                    <div>
                      <span className="bo-menu-type">{TYPE_LABELS[item.productType] || "Plat"}</span>
                      <p className="bo-menu-title">{current?.title || "(sans titre)"}</p>
                      {hasUnpublished && item.status !== "archived" && <p className="bo-menu-unpublished">Modifications non publiées</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell><StatusBadge status={item.status} /></TableCell>
                <TableCell><span className={`bo-menu-availability ${item.available ? "is-available" : "is-unavailable"}`}>{item.available ? "Disponible" : "Rupture"}</span></TableCell>
                <TableCell>{item.sortOrder}</TableCell>
                <TableCell>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("fr-FR") : "—"}</TableCell>
                <TableCell>
                  <div className="bo-row-actions">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(item)}>Modifier</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onPreview(item)}>Aperçu</Button>
                    {item.status !== "archived" && hasUnpublished && (
                      <Button type="button" variant="outline" size="sm" onClick={() => onPublish(item)}>Publier</Button>
                    )}
                    {item.status !== "archived" && (
                      <Button type="button" variant="outline" size="sm" onClick={() => onAvailability(item)} disabled={availabilityId === item.id}>
                        {availabilityId === item.id ? "…" : item.available ? "Rupture" : "Rendre disponible"}
                      </Button>
                    )}
                    {item.status !== "archived" && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => onArchive(item)}>
                        {archivingId === item.id ? "Confirmer ?" : "Archiver"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
