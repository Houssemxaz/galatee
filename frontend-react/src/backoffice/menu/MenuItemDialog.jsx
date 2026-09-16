import { useEffect, useRef, useState } from "react";
import { Trash2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, apiUpload, apiMessage } from "../api";

const CATEGORY_OPTIONS = [
  { value: "fresca", label: "Pasta fresca" },
  { value: "ripiena", label: "Pasta ripiena" },
  { value: "vegetal", label: "Végétal" },
];
const TYPE_OPTIONS = [
  { value: "dish", label: "Plat" },
  { value: "menu", label: "Menu" },
  { value: "offer", label: "Offre" },
];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function emptyForm() {
  return { itemType: "dish", title: "", shortDescription: "", longDescription: "", category: "fresca", sortOrder: "1", price: "", available: true };
}

function formFromRevision(revision, item) {
  if (!revision) return emptyForm();
  return {
    itemType: revision.productType || "dish",
    title: revision.title || "",
    shortDescription: revision.shortDescription || "",
    longDescription: revision.longDescription || "",
    category: item?.category || "fresca",
    sortOrder: String(item?.sortOrder ?? 1),
    price: revision.price || "",
    available: revision.available !== false,
  };
}

function validateFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Formats acceptés: JPEG, PNG, WebP.";
  if (file.size > MAX_BYTES) return "Image trop lourde (5 Mo maximum).";
  return "";
}

export default function MenuItemDialog({ open, onOpenChange, item, onSaved, onDeleted }) {
  const [itemId, setItemId] = useState(item?.id || null);
  const [imageUrl, setImageUrl] = useState(item?.current?.imageUrl || "");
  const [form, setForm] = useState(() => formFromRevision(item?.current, item));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    setItemId(item?.id || null);
    setImageUrl(item?.current?.imageUrl || "");
    setForm(formFromRevision(item?.current, item));
    setError("");
    setPendingFile(null);
    setFileError("");
    setConfirmDelete(false);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, open]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleFilePick(file) {
    if (!file) return;
    setFileError("");
    const err = validateFile(file);
    if (err) { setFileError(err); return; }
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  }

  function clearPending() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
    setFileError("");
  }

  function buildPayload() {
    return {
      itemType: form.itemType,
      title: form.title,
      shortDescription: form.shortDescription,
      longDescription: form.longDescription,
      category: form.category,
      sortOrder: Number(form.sortOrder) || 1,
      price: form.price,
      imageAlt: form.title,
      available: form.available,
    };
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let saved;
      if (itemId) {
        const res = await apiRequest(`/admin/menu/${encodeURIComponent(itemId)}`, {
          method: "PATCH",
          body: JSON.stringify(buildPayload()),
        });
        saved = res.menuItem;
      } else {
        const res = await apiRequest("/admin/menu", { method: "POST", body: JSON.stringify(buildPayload()) });
        saved = res.menuItem;
        setItemId(saved.id);
      }

      // Upload pending image if any
      if (pendingFile && saved?.id) {
        const fd = new FormData();
        fd.append("image", pendingFile);
        const upl = await apiUpload(`/admin/menu/${encodeURIComponent(saved.id)}/image`, fd);
        saved = upl.menuItem;
        setImageUrl(saved.current?.imageUrl || "");
        clearPending();
      }

      onSaved(saved);
      onOpenChange(false);
    } catch (submitError) {
      setError(apiMessage(submitError, "Le plat n'a pas pu être enregistré."));
    } finally {
      setSaving(false);
    }
  }

  async function removeExistingImage() {
    if (!itemId) return;
    try {
      const { menuItem } = await apiRequest(`/admin/menu/${encodeURIComponent(itemId)}/image`, { method: "DELETE" });
      setImageUrl("");
      onSaved(menuItem);
    } catch (err) {
      setFileError(apiMessage(err, "Impossible de supprimer l'image."));
    }
  }

  async function deleteItem() {
    if (!itemId) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const { menuItem } = await apiRequest(`/admin/menu/${encodeURIComponent(itemId)}`, { method: "DELETE" });
      onDeleted?.(menuItem);
      onOpenChange(false);
    } catch (err) {
      setError(apiMessage(err, "La suppression a échoué."));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const displayImage = pendingPreview || imageUrl;
  const isDraftOnly = item && (!item.published || item.status === "draft");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bo-dialog bo-dialog-wide">
        <DialogHeader>
          <DialogTitle className="bo-dialog-title">{itemId ? "Modifier l'élément" : "Nouvel élément"}</DialogTitle>
          <DialogDescription className="bo-dialog-desc">
            {itemId ? "Les changements créent un nouveau brouillon. Publiez pour les rendre visibles." : "L'élément est créé en brouillon. Publiez ensuite pour l'afficher sur le site."}
          </DialogDescription>
        </DialogHeader>
        <form className="bo-form" onSubmit={submit}>
          <div className="bo-form-grid">
            <div className="bo-form-col">
              <div className="bo-field-group">
                <Label htmlFor="mi-type">Type</Label>
                <select id="mi-type" className="bo-native-select" value={form.itemType} onChange={(e) => update("itemType", e.target.value)}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="bo-field-group">
                <Label htmlFor="mi-title">Titre</Label>
                <Input id="mi-title" value={form.title} onChange={(e) => update("title", e.target.value)} required maxLength={120} />
              </div>
              <div className="bo-field-row">
                <div className="bo-field-group">
                  <Label htmlFor="mi-category">Catégorie</Label>
                  <select id="mi-category" className="bo-native-select" value={form.category} onChange={(e) => update("category", e.target.value)}>
                    {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="bo-field-group">
                  <Label htmlFor="mi-sort">Ordre</Label>
                  <Input id="mi-sort" type="number" min="0" max="10000" value={form.sortOrder} onChange={(e) => update("sortOrder", e.target.value)} />
                </div>
                <div className="bo-field-group">
                  <Label htmlFor="mi-price">Prix (DZD)</Label>
                  <Input id="mi-price" inputMode="decimal" placeholder="32.00" value={form.price} onChange={(e) => update("price", e.target.value)} required />
                </div>
              </div>
              <div className="bo-field-group">
                <Label htmlFor="mi-short">Description courte</Label>
                <Input id="mi-short" value={form.shortDescription} onChange={(e) => update("shortDescription", e.target.value)} maxLength={240} />
              </div>
              <div className="bo-field-group">
                <Label htmlFor="mi-long">Description longue</Label>
                <textarea id="mi-long" className="bo-textarea" rows={5} value={form.longDescription} onChange={(e) => update("longDescription", e.target.value)} maxLength={2000} />
              </div>
              <label className="bo-availability-toggle"><input type="checkbox" checked={form.available} onChange={(e) => update("available", e.target.checked)} /><span>Élément disponible à la commande</span></label>
            </div>

            <div className="bo-form-col bo-form-col-image">
              <Label>Photo de l'élément</Label>
              <div className="bo-image-panel">
                {displayImage ? (
                  <div className="bo-image-preview-block">
                    <img src={displayImage} alt="" className="bo-image-preview" />
                    <div className="bo-image-actions">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={13} /> Remplacer
                      </Button>
                      {pendingPreview ? (
                        <Button type="button" variant="ghost" size="sm" onClick={clearPending}>
                          <X size={13} /> Annuler
                        </Button>
                      ) : imageUrl && itemId ? (
                        <Button type="button" variant="ghost" size="sm" onClick={removeExistingImage}>
                          <Trash2 size={13} /> Retirer
                        </Button>
                      ) : null}
                    </div>
                    {pendingPreview && <p className="bo-form-hint">L'image sera envoyée à l'enregistrement.</p>}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="bo-image-drop"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("is-dragging"); }}
                    onDragLeave={(e) => e.currentTarget.classList.remove("is-dragging")}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("is-dragging");
                      handleFilePick(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <Upload size={20} strokeWidth={1.5} />
                    <span>Glissez une image ou cliquez</span>
                    <span className="bo-form-hint">JPEG, PNG, WebP · 5 Mo max</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => { handleFilePick(e.target.files?.[0]); e.target.value = ""; }}
                />
                {fileError && <p className="bo-image-error" role="alert">{fileError}</p>}
              </div>
            </div>
          </div>

          {error && <p className="bo-form-error" role="alert">{error}</p>}

          <div className="bo-dialog-actions bo-dialog-actions-split">
            <div>
              {itemId && (
                <Button
                  type="button"
                  variant="ghost"
                  className="bo-action-delete"
                  onClick={deleteItem}
                  disabled={deleting}
                >
                  <Trash2 size={13} />
                  {confirmDelete
                    ? (isDraftOnly ? "Confirmer la suppression" : "Confirmer l'archivage")
                    : (isDraftOnly ? "Supprimer le brouillon" : "Archiver le plat")}
                </Button>
              )}
            </div>
            <div className="bo-dialog-actions-right">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement…" : (itemId ? "Enregistrer le brouillon" : "Créer le plat")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
