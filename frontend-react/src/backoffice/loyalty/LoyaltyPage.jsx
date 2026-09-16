import { useCallback, useEffect, useState } from "react";
import { Award, Gift, Search, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiMessage, apiRequest } from "../api";

const DEFAULT_SETTINGS = {
  threshold: 10,
  rewardType: "percentage",
  rewardValue: 10,
  title: "Récompense Pasta Lover",
  description: "Une remise sur votre prochaine commande.",
  active: true,
};

function rewardLabel(settings) {
  if (settings.rewardType === "fixed") return `${settings.rewardValue} DA`;
  return `${settings.rewardValue} %`;
}

export default function LoyaltyPage() {
  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async (term = search) => {
    setState("loading");
    try {
      const query = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : "";
      const payload = await apiRequest(`/admin/loyalty${query}`);
      setSettings(payload.settings || DEFAULT_SETTINGS);
      setCustomers(payload.customers || []);
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger la fidélité.") });
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function change(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setAlert(null);
    try {
      const payload = await apiRequest("/admin/loyalty", {
        method: "PUT",
        body: JSON.stringify({ ...settings, threshold: Number(settings.threshold), rewardValue: Number(settings.rewardValue) }),
      });
      setSettings(payload.settings);
      setAlert({ kind: "success", message: "Programme fidélité enregistré." });
      await load();
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Enregistrement impossible.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bo-loyalty-page">
      <div className="bo-panel-heading bo-loyalty-heading"><div><p className="bo-eyebrow">Relation client</p><h2>Fidélité et promotions</h2><p className="bo-page-intro">Récompensez les clients qui reviennent chez Galatee.</p></div><Gift size={24} strokeWidth={1.5} aria-hidden="true" /></div>
      {alert && <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>}
      {state === "loading" && <p className="bo-empty">Chargement de la fidélité…</p>}
      {state === "error" && <p className="bo-empty">La fidélité n’a pas pu être chargée.</p>}
      {state === "ready" && settings && <>
        <form className="bo-loyalty-settings" onSubmit={save}>
          <div className="bo-loyalty-settings-top"><div><p className="bo-eyebrow">Règle actuelle</p><h3>{settings.active ? `${settings.threshold} commandes · ${rewardLabel(settings)}` : "Programme désactivé"}</h3></div><label className="bo-schedule-switch"><input type="checkbox" checked={settings.active} onChange={(event) => change("active", event.target.checked)} /><span className="bo-schedule-switch-control" aria-hidden="true">✓</span><span>Programme actif</span></label></div>
          <div className="bo-loyalty-fields"><label>Seuil de commandes<input type="number" min="1" max="100" value={settings.threshold} onChange={(event) => change("threshold", event.target.value)} /></label><label>Type de récompense<select value={settings.rewardType} onChange={(event) => change("rewardType", event.target.value)}><option value="percentage">Pourcentage</option><option value="fixed">Montant fixe en DA</option></select></label><label>Valeur de la récompense<input type="number" min="1" max={settings.rewardType === "percentage" ? "100" : "100000"} value={settings.rewardValue} onChange={(event) => change("rewardValue", event.target.value)} /></label><label>Nom de la récompense<input value={settings.title} maxLength={120} onChange={(event) => change("title", event.target.value)} /></label><label className="bo-loyalty-field-wide">Message client<textarea rows="2" maxLength={300} value={settings.description} onChange={(event) => change("description", event.target.value)} /></label></div>
          <div className="bo-loyalty-actions"><span>La récompense est créée lorsque la commande est livrée, retirée ou terminée.</span><Button className="bo-schedule-save" size="sm" type="submit" disabled={busy}><Save size={14} /> {busy ? "Enregistrement…" : "Enregistrer la règle"}</Button></div>
        </form>
        <div className="bo-loyalty-customers"><div className="bo-section-heading"><div><p className="bo-eyebrow">Suivi des membres</p><h3>Progression des clients</h3></div><form className="bo-loyalty-search" onSubmit={(event) => { event.preventDefault(); load(search); }}><Search size={15} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, email ou téléphone" aria-label="Rechercher un client" /></form></div>{customers.length === 0 ? <p className="bo-empty">Aucun client inscrit.</p> : <div className="bo-loyalty-customer-list">{customers.map((customer) => { const percent = customer.rewardAvailable ? 100 : Math.min(100, (customer.progressInCycle / customer.settings.threshold) * 100); return <article className="bo-loyalty-customer" key={customer.id}><div className="bo-loyalty-customer-name"><span className="bo-loyalty-avatar"><Award size={15} /></span><div><strong>{customer.firstName} {customer.lastName}</strong><small>{customer.email}</small></div></div><div className="bo-loyalty-customer-progress"><div><span>{customer.qualifyingOrders} commande{customer.qualifyingOrders > 1 ? "s" : ""}</span><strong>{customer.rewardAvailable ? customer.rewardAvailable.title : `${customer.ordersToNextReward} restante${customer.ordersToNextReward > 1 ? "s" : ""}`}</strong></div><span className="bo-loyalty-track"><i style={{ width: `${percent}%` }} /></span></div></article>; })}</div>}</div>
      </>}
    </section>
  );
}
