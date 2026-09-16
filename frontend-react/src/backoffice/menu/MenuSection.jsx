import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest, apiMessage } from "../api";
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

  const load = useCallback(async () => {
    setState("loading");
    try {
      const payload = await apiRequest("/admin/menu");
      setItems(payload.menu);
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger le menu.") });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, token]);

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
    if (archivingId !== item.id) {
      setArchivingId(item.id);
      return;
    }
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

  return (
    <div className="bo-panel">
      <div className="bo-panel-heading">
        <div>
          <p className="bo-eyebrow">Contenu</p>
          <h2>Menu</h2>
        </div>
          <Button type="button" onClick={() => setDialogItem(null)}>Nouvel élément</Button>
      </div>

      {alert && <p className="bo-alert" data-kind={alert.kind} role="status">{alert.message}</p>}
      {state === "loading" && <p className="bo-empty">Chargement...</p>}
      {state === "ready" && (
        <MenuTable
          items={items}
          onEdit={setDialogItem}
          onPreview={setPreviewItem}
          onPublish={publish}
          onArchive={archive}
          onAvailability={toggleAvailability}
          availabilityId={availabilityId}
          archivingId={archivingId}
        />
      )}

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
