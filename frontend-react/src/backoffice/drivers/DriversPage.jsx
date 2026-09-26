import { useCallback, useEffect, useState } from "react";
import { Bike, Plus, Save, KeyRound, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiMessage, apiRequest } from "../api";

function STATUS_LABEL(status) {
  if (status === "available") return "Disponible";
  if (status === "busy") return "En course";
  return "Hors ligne";
}

function formatDzd(cents) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(cents || 0) / 100))} DA`;
}

const EMPTY_FORM = { firstName: "", lastName: "", phone: "", pin: "", notes: "" };

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [state, setState] = useState("loading");
  const [alert, setAlert] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [pinDialog, setPinDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const query = includeInactive ? "?includeInactive=true" : "";
      const payload = await apiRequest(`/admin/drivers${query}`);
      setDrivers(payload.drivers || []);
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger les livreurs.") });
    }
  }, [includeInactive]);

  useEffect(() => { load(); }, [load]);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(driver) {
    setEditing(driver);
    setForm({
      firstName: driver.firstName,
      lastName: driver.lastName || "",
      phone: driver.phone,
      pin: "",
      notes: driver.notes || "",
    });
  }

  function startCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setAlert(null);
    try {
      if (editing) {
        const payload = await apiRequest(`/admin/drivers/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            notes: form.notes,
            ...(form.pin ? { pin: form.pin } : {}),
          }),
        });
        setAlert({ kind: "success", message: `${payload.driver.firstName} mis à jour.` });
      } else {
        const payload = await apiRequest("/admin/drivers", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setAlert({ kind: "success", message: `${payload.driver.firstName} ajouté.` });
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      await load();
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Enregistrement impossible.") });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(driver) {
    setBusy(true);
    setAlert(null);
    try {
      if (driver.active) {
        await apiRequest(`/admin/drivers/${encodeURIComponent(driver.id)}`, { method: "DELETE" });
        setAlert({ kind: "success", message: `${driver.firstName} désactivé.` });
      } else {
        await apiRequest(`/admin/drivers/${encodeURIComponent(driver.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ active: true }),
        });
        setAlert({ kind: "success", message: `${driver.firstName} réactivé.` });
      }
      await load();
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Opération impossible.") });
    } finally {
      setBusy(false);
    }
  }

  async function resetPin(event) {
    event.preventDefault();
    if (!pinDialog) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/drivers/${encodeURIComponent(pinDialog.driver.id)}/pin`, {
        method: "POST",
        body: JSON.stringify({ pin: pinDialog.pin }),
      });
      setAlert({ kind: "success", message: `Nouveau code défini pour ${pinDialog.driver.firstName}.` });
      setPinDialog(null);
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de mettre à jour le code.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bo-drivers-page">
      <div className="bo-panel-heading">
        <div>
          <p className="bo-eyebrow">Opérations</p>
          <h2>Livreurs</h2>
          <p className="bo-page-intro">Enregistrez les livreurs du restaurant et gérez leurs codes d'accès à la PWA livreur.</p>
        </div>
        <Bike size={24} strokeWidth={1.5} aria-hidden="true" />
      </div>

      {alert && (
        <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">
          {alert.message}
        </p>
      )}

      <form className="bo-drivers-form" onSubmit={save}>
        <div className="bo-drivers-form-head">
          <h3>{editing ? `Modifier ${editing.firstName}` : "Nouveau livreur"}</h3>
          {editing && (
            <button type="button" onClick={startCreate} className="bo-link-btn">
              + Ajouter un autre livreur
            </button>
          )}
        </div>
        <div className="bo-drivers-form-grid">
          <label>
            Prénom
            <input value={form.firstName} onChange={(e) => change("firstName", e.target.value)} required />
          </label>
          <label>
            Nom
            <input value={form.lastName} onChange={(e) => change("lastName", e.target.value)} />
          </label>
          <label>
            Téléphone
            <input type="tel" value={form.phone} onChange={(e) => change("phone", e.target.value)} placeholder="+213555000000" required />
          </label>
          <label>
            Code PIN {editing && <small>(vide = inchangé)</small>}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4,8}"
              minLength={editing ? 0 : 4}
              maxLength={8}
              value={form.pin}
              onChange={(e) => change("pin", e.target.value.replace(/\D/g, ""))}
              placeholder="4 à 8 chiffres"
              required={!editing}
            />
          </label>
          <label className="bo-drivers-form-wide">
            Note interne
            <textarea rows={2} maxLength={500} value={form.notes} onChange={(e) => change("notes", e.target.value)} />
          </label>
        </div>
        <div className="bo-drivers-form-actions">
          <Button size="sm" type="submit" disabled={busy}>
            {editing ? <><Save size={14} /> Mettre à jour</> : <><Plus size={14} /> Créer le livreur</>}
          </Button>
        </div>
      </form>

      <div className="bo-drivers-list-head">
        <h3>Équipe ({drivers.length})</h3>
        <label className="bo-availability-toggle">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Afficher les livreurs désactivés
        </label>
      </div>

      {state === "loading" && <p className="bo-empty">Chargement…</p>}
      {state === "error" && <p className="bo-empty">Impossible de charger les livreurs.</p>}
      {state === "ready" && drivers.length === 0 && (
        <p className="bo-empty">Aucun livreur enregistré pour l'instant.</p>
      )}

      {state === "ready" && drivers.length > 0 && (
        <div className="bo-drivers-grid">
          {drivers.map((driver) => (
            <article key={driver.id} className={`bo-driver-card ${driver.active ? "" : "is-inactive"}`}>
              <header className="bo-driver-card-head">
                <div>
                  <p className="bo-driver-card-name">
                    {driver.firstName} {driver.lastName}
                  </p>
                  <p className="bo-driver-card-phone">{driver.phone}</p>
                </div>
                <span className={`bo-driver-badge is-${driver.currentStatus}`}>
                  {STATUS_LABEL(driver.currentStatus)}
                </span>
              </header>

              <div className="bo-driver-stats">
                <div>
                  <span>Aujourd'hui</span>
                  <strong>{driver.stats?.today?.delivered ?? 0}</strong>
                </div>
                <div>
                  <span>Ce mois</span>
                  <strong>{driver.stats?.month?.delivered ?? 0}</strong>
                </div>
                <div>
                  <span>Total livrées</span>
                  <strong>{driver.stats?.lifetime?.delivered ?? 0}</strong>
                </div>
                <div>
                  <span>Annulées (mois)</span>
                  <strong className="bo-driver-stats-cancel">{driver.stats?.month?.cancelled ?? 0}</strong>
                </div>
              </div>

              {driver.notes && <p className="bo-driver-notes">{driver.notes}</p>}

              <div className="bo-driver-card-actions">
                <button type="button" className="bo-link-btn" onClick={() => startEdit(driver)}>
                  Modifier
                </button>
                <button type="button" className="bo-link-btn" onClick={() => setPinDialog({ driver, pin: "" })}>
                  <KeyRound size={12} /> Réinitialiser PIN
                </button>
                <button
                  type="button"
                  className="bo-link-btn"
                  onClick={() => toggleActive(driver)}
                  disabled={busy}
                >
                  {driver.active ? <><Pause size={12} /> Désactiver</> : <><Play size={12} /> Réactiver</>}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {pinDialog && (
        <div className="bo-dialog-backdrop" onClick={() => setPinDialog(null)}>
          <form
            className="bo-dialog"
            onClick={(e) => e.stopPropagation()}
            onSubmit={resetPin}
          >
            <h4>Nouveau code PIN pour {pinDialog.driver.firstName}</h4>
            <p className="bo-dialog-note">
              Ce code remplacera le précédent. Les sessions actives du livreur seront invalidées.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4,8}"
              minLength={4}
              maxLength={8}
              value={pinDialog.pin}
              onChange={(e) => setPinDialog({ ...pinDialog, pin: e.target.value.replace(/\D/g, "") })}
              placeholder="4 à 8 chiffres"
              autoFocus
              required
            />
            <div className="bo-dialog-actions">
              <button type="button" className="bo-link-btn" onClick={() => setPinDialog(null)}>
                Annuler
              </button>
              <Button size="sm" type="submit" disabled={busy || pinDialog.pin.length < 4}>
                Enregistrer
              </Button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
