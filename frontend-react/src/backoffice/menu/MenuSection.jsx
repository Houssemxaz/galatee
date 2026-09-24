import { useCallback, useEffect, useState } from "react";
import { Plus, LayoutGrid, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, apiMessage } from "../api";
import { SkeletonRows, EmptyState } from "../shared/primitives.jsx";
import MenuTable from "./MenuTable.jsx";
import MenuItemDialog from "./MenuItemDialog.jsx";
import MenuPreviewDialog from "./MenuPreviewDialog.jsx";

export default function MenuSection({ token }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState("idle");
  const [alert, setAlert] = useState(null);
  const [dialogItem, setDialogItem] = useState(undefined);
  const [previewItem, setPreviewItem] = useState(null);
  const [availabilityId, setAvailabilityId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const payload = await apiRequest(`/admin/menu${showArchived ? "?includeArchived=true" : ""}`);
      setItems(payload.menu);
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger le menu.") });
    }
  }, [showArchived]);

  useEffect(() => { load(); }, [load, token]);

  function handleSaved(menuItem) {
    setItems((current) => {
      const exists = current.some((entry) => entry.id === menuItem.id);
      return exists ? current.map((entry) => (entry.id === menuItem.id ? menuItem : entry)) : [...current, menuItem];
    });
    setAlert({ kind: "success", message: "Élément enregistré." });
  }

  async function publish(item) {
    try {
      const { menuItem } = await apiRequest(`/admin/menu/${encodeURIComponent(item.id)}/publish`, { method: "POST" });
      handleSaved(menuItem);
      setAlert({ kind: "success", message: `"${menuItem.current.title}" est publié.` });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "La publication a échoué.") });
    }
  }

  async function archive(item) {
    if (archivingId !== item.id) { setArchivingId(item.id); return; }
    setArchivingId(null);
    try {
      const { menuItem } = await apiRequest(`/admin/menu/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setItems((current) => current.filter((entry) => entry.id !== menuItem.id));
      setAlert({ kind: "success", message: `"${menuItem.current?.title}" est archivé.` });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "L'archivage a échoué.") });
    }
  }

  async function toggleAvailability(item) {
    setAvailabilityId(item.id);
    try {
      const { menuItem } = await apiRequest(`/admin/menu/${encodeURIComponent(item.id)}/availability`, { method: "PATCH", body: JSON.stringify({ available: !item.available }) });
      handleSaved(menuItem);
      setAlert({ kind: "success", message: menuItem.available ? "Élément rendu disponible." : "Élément passé en rupture." });
    } catch (error) { setAlert({ kind: "error", message: apiMessage(error, "La disponibilité n'a pas été modifiée.") }); }
    finally { setAvailabilityId(null); }
  }

  async function restore(item) {
    try {
      const { menuItem } = await apiRequest(`/admin/menu/${encodeURIComponent(item.id)}/restore`, { method: "POST" });
      handleSaved(menuItem);
      setAlert({ kind: "success", message: `"${menuItem.current?.title}" est restauré en brouillon.` });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "La restauration a échoué.") });
    }
  }

  return (
    <div className="bo-page">
      <section className="bo-table-wrap">
        <div className="bo-table-heading">
          <div>
            <p className="bo-eyebrow">Contenu</p>
            <h2 className="bo-table-title">Menu</h2>
          </div>
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <label className="bo-availability-toggle" style={{ marginRight: 4 }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Afficher les archives
            </label>
            <Button type="button" variant="outline" size="sm" onClick={load} aria-label="Rafraîchir le menu">
              <RefreshCw size={13} strokeWidth={1.8} />
            </Button>
            <Button type="button" onClick={() => setDialogItem(null)}>
              <Plus size={14} strokeWidth={2} />
              Nouvel élément
            </Button>
          </div>
        </div>

        {alert && <p className="bo-alert" data-kind={alert.kind} role="status" style={{ margin: "12px 16px" }}>{alert.message}</p>}

        {state === "loading" && (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Élément</th><th>Catégorie</th><th>Statut</th><th>Dispo</th><th>Ordre</th><th>Mis à jour</th><th />
              </tr>
            </thead>
            <tbody>
              <SkeletonRows rows={4} cols={7} />
            </tbody>
          </table>
        )}

        {state === "error" && (
          <EmptyState
            icon={LayoutGrid}
            title="Impossible de charger le menu"
            description="Vérifiez la connexion au serveur puis réessayez."
            actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw size={13} /> Réessayer</Button>}
          />
        )}

        {state === "ready" && (
          <MenuTable
            items={items}
            onEdit={setDialogItem}
            onPreview={setPreviewItem}
            onPublish={publish}
            onArchive={archive}
            onRestore={restore}
            onAvailability={toggleAvailability}
            availabilityId={availabilityId}
            archivingId={archivingId}
          />
        )}
      </section>

      <MenuItemDialog
        open={dialogItem !== undefined}
        onOpenChange={(open) => !open && setDialogItem(undefined)}
        item={dialogItem}
        onSaved={handleSaved}
        onDeleted={(menuItem) => {
          setItems((current) => current.filter((entry) => entry.id !== menuItem.id));
          setAlert({ kind: "success", message: `"${menuItem.current?.title || menuItem.published?.title || 'Plat'}" supprimé.` });
        }}
      />
      <MenuPreviewDialog item={previewItem} onOpenChange={setPreviewItem} />
    </div>
  );
}
