import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MapPin, Plus, RefreshCw, Save, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiMessage, apiRequest } from "../api";

function formatDzd(cents) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`;
}

function draftFrom(commune) {
  return { name: commune.name, fee: Math.round(commune.feeCents / 100), active: commune.active };
}

export default function DeliveryPage() {
  const [communes, setCommunes] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [newCommune, setNewCommune] = useState({ name: "", fee: "", active: true });
  const [state, setState] = useState("loading");
  const [busyId, setBusyId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const payload = await apiRequest("/admin/delivery-communes");
      const next = payload.communes || [];
      setCommunes(next);
      setDrafts(Object.fromEntries(next.map((commune) => [commune.id, draftFrom(commune)])));
      setState("ready");
      setAlert(null);
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger la configuration de livraison.") });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = useMemo(() => communes.filter((commune) => commune.active).length, [communes]);
  const feeRange = useMemo(() => {
    if (!communes.length) return "Aucun tarif";
    const fees = communes.map((commune) => commune.feeCents);
    return `${formatDzd(Math.min(...fees))} - ${formatDzd(Math.max(...fees))}`;
  }, [communes]);

  function updateDraft(id, field, value) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }

  async function saveCommune(id) {
    setBusyId(id);
    setAlert(null);
    try {
      const payload = await apiRequest(`/admin/delivery-communes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(drafts[id]),
      });
      setCommunes((current) => current.map((item) => item.id === id ? payload.commune : item));
      setDrafts((current) => ({ ...current, [id]: draftFrom(payload.commune) }));
      setAlert({ kind: "success", message: `Configuration de ${payload.commune.name} enregistrée.` });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "La configuration n'a pas été enregistrée.") });
    } finally {
      setBusyId(null);
    }
  }

  async function addCommune(event) {
    event.preventDefault();
    setBusy(true);
    setAlert(null);
    try {
      const payload = await apiRequest("/admin/delivery-communes", {
        method: "POST",
        body: JSON.stringify(newCommune),
      });
      setCommunes((current) => [...current, payload.commune]);
      setDrafts((current) => ({ ...current, [payload.commune.id]: draftFrom(payload.commune) }));
      setNewCommune({ name: "", fee: "", active: true });
      setAlert({ kind: "success", message: `${payload.commune.name} a été ajoutée aux zones desservies.` });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "La commune n'a pas été ajoutée.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bo-delivery-page">
      <div className="bo-panel-heading bo-delivery-heading">
        <div>
          <p className="bo-eyebrow">Logistique</p>
          <h2>Configuration de livraison</h2>
          <p className="bo-page-intro">Définissez les communes desservies par Galatée et le tarif ajouté à chaque commande.</p>
        </div>
        <Truck size={25} strokeWidth={1.5} aria-hidden="true" />
      </div>

      {alert && <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>}

      <section className="bo-delivery-kpis" aria-label="Résumé de la livraison">
        <div className="bo-delivery-kpi"><span className="bo-delivery-kpi-icon"><MapPin size={16} /></span><div><strong>{activeCount}</strong><span>communes actives</span></div></div>
        <div className="bo-delivery-kpi"><span className="bo-delivery-kpi-icon"><Check size={16} /></span><div><strong>{communes.length}</strong><span>zones configurées</span></div></div>
        <div className="bo-delivery-kpi bo-delivery-kpi-wide"><span className="bo-delivery-kpi-icon"><Truck size={16} /></span><div><strong>{feeRange}</strong><span>fourchette des tarifs actuels</span></div></div>
      </section>

      <section className="bo-delivery-panel">
        <div className="bo-section-heading">
          <div><p className="bo-eyebrow">Zones desservies</p><h3>Communes et tarifs</h3></div>
          <Button variant="outline" size="sm" onClick={load} disabled={state === "loading"} aria-label="Actualiser les communes"><RefreshCw size={14} /> Actualiser</Button>
        </div>
        <p className="bo-delivery-note">Une commune inactive reste dans l'historique, mais elle disparaît du formulaire de commande public.</p>
        {state === "loading" && <p className="bo-empty">Chargement des communes…</p>}
        {state === "error" && <p className="bo-empty">La configuration n'a pas pu être chargée.</p>}
        {state === "ready" && !communes.length && <p className="bo-empty">Aucune commune configurée.</p>}
        {state === "ready" && communes.length > 0 && <div className="bo-delivery-list">
          {communes.map((commune) => {
            const draft = drafts[commune.id] || draftFrom(commune);
            return <article className={`bo-delivery-row ${draft.active ? "" : "is-inactive"}`} key={commune.id}>
              <div className="bo-delivery-row-main"><span className="bo-delivery-row-icon"><MapPin size={15} /></span><div><strong>{commune.name}</strong><small>{draft.active ? "Proposée au client" : "Non proposée au client"}</small></div></div>
              <label className="bo-delivery-field"><span>Nom de la commune</span><Input value={draft.name} maxLength={100} onChange={(event) => updateDraft(commune.id, "name", event.target.value)} /></label>
              <label className="bo-delivery-field bo-delivery-fee"><span>Tarif en DA</span><Input type="number" min="0" step="50" value={draft.fee} onChange={(event) => updateDraft(commune.id, "fee", event.target.value)} /></label>
              <label className="bo-schedule-switch bo-delivery-active"><input type="checkbox" checked={Boolean(draft.active)} onChange={(event) => updateDraft(commune.id, "active", event.target.checked)} /><span className="bo-schedule-switch-control" aria-hidden="true">✓</span><span>Active</span></label>
              <Button size="sm" onClick={() => saveCommune(commune.id)} disabled={busyId === commune.id}><Save size={14} /> {busyId === commune.id ? "Enregistrement…" : "Enregistrer"}</Button>
            </article>;
          })}
        </div>}
      </section>

      <section className="bo-delivery-panel bo-delivery-add-panel">
        <div className="bo-section-heading"><div><p className="bo-eyebrow">Extension de la zone</p><h3>Ajouter une commune</h3></div><Plus size={21} aria-hidden="true" /></div>
        <form className="bo-delivery-add-form" onSubmit={addCommune}>
          <label className="bo-delivery-field"><span>Commune</span><Input value={newCommune.name} maxLength={100} placeholder="Ex. Kouba" onChange={(event) => setNewCommune((current) => ({ ...current, name: event.target.value }))} required /></label>
          <label className="bo-delivery-field"><span>Tarif de livraison en DA</span><Input type="number" min="0" step="50" value={newCommune.fee} placeholder="Ex. 800" onChange={(event) => setNewCommune((current) => ({ ...current, fee: event.target.value }))} required /></label>
          <label className="bo-schedule-switch bo-delivery-add-active"><input type="checkbox" checked={newCommune.active} onChange={(event) => setNewCommune((current) => ({ ...current, active: event.target.checked }))} /><span className="bo-schedule-switch-control" aria-hidden="true">✓</span><span>Disponible immédiatement</span></label>
          <Button type="submit" disabled={busy}><Plus size={14} /> {busy ? "Ajout…" : "Ajouter la commune"}</Button>
        </form>
      </section>
    </div>
  );
}
