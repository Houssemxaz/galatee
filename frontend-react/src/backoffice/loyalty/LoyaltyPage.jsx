import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Gift, Search, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiMessage, apiRequest } from "../api";
import { calculateRewardDiscountCents } from "@/lib/loyalty";

const DEFAULT_SETTINGS = {
  threshold: 10,
  rewardType: "percentage",
  rewardValue: 10,
  rewardScope: "items",
  title: "Récompense Pasta Lover",
  description: "Une remise sur votre prochaine commande.",
  active: true,
  eligibleDishIds: [],
  rewardExpirationDays: 90,
};

function rewardLabel(settings) {
  if (settings.rewardType === "fixed") return `${settings.rewardValue} DA`;
  return `${settings.rewardValue} %`;
}

function scopeLabel(settings, dishes) {
  if (!settings.eligibleDishIds?.length) return "Tous les plats";
  if (settings.eligibleDishIds.length === 1) {
    const dish = dishes.find((entry) => entry.id === settings.eligibleDishIds[0]);
    return dish?.current?.title ? `Uniquement : ${dish.current.title}` : "1 plat sélectionné";
  }
  return `${settings.eligibleDishIds.length} plats sélectionnés`;
}

function formatDzd(cents) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`;
}

export default function LoyaltyPage() {
  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async (term = search) => {
    setState("loading");
    try {
      const query = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : "";
      const [loyaltyPayload, menuPayload] = await Promise.all([
        apiRequest(`/admin/loyalty${query}`),
        apiRequest("/admin/menu"),
      ]);
      const nextSettings = loyaltyPayload.settings || DEFAULT_SETTINGS;
      setSettings({ ...nextSettings, eligibleDishIds: nextSettings.eligibleDishIds || [] });
      setCustomers(loyaltyPayload.customers || []);
      setDishes(menuPayload.menu || []);
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

  function toggleDish(dishId) {
    setSettings((current) => {
      const ids = current.eligibleDishIds || [];
      const nextIds = ids.includes(dishId)
        ? ids.filter((id) => id !== dishId)
        : [...ids, dishId];
      return { ...current, eligibleDishIds: nextIds };
    });
  }

  function selectAllDishes() {
    setSettings((current) => ({ ...current, eligibleDishIds: [], rewardScope: "items" }));
  }

  const scope = useMemo(() => (
    settings?.eligibleDishIds?.length ? "specific" : "all"
  ), [settings?.eligibleDishIds]);

  const preview = useMemo(() => {
    if (!settings) return { items: [], initialCents: 0, discountCents: 0, afterCents: 0 };
    const selected = settings.eligibleDishIds?.length
      ? dishes.filter((dish) => settings.eligibleDishIds.includes(dish.id))
      : dishes;
    const items = selected.map((dish) => ({
      id: dish.id,
      title: dish.current?.title || dish.published?.title || "(sans titre)",
      priceCents: Math.max(0, Number(dish.current?.priceCents ?? dish.published?.priceCents ?? 0)),
    }));
    const initialCents = items.reduce((sum, item) => sum + item.priceCents, 0);
    const discountCents = calculateRewardDiscountCents(initialCents, settings.rewardType, settings.rewardValue);
    return { items, initialCents, discountCents, afterCents: Math.max(0, initialCents - discountCents) };
  }, [dishes, settings]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setAlert(null);
    try {
      const payload = await apiRequest("/admin/loyalty", {
        method: "PUT",
        body: JSON.stringify({
          ...settings,
          threshold: Number(settings.threshold),
          rewardValue: Number(settings.rewardValue),
          rewardScope: settings.rewardScope || "items",
          rewardExpirationDays: Number(settings.rewardExpirationDays ?? 90),
          eligibleDishIds: settings.eligibleDishIds || [],
        }),
      });
      setSettings({ ...payload.settings, eligibleDishIds: payload.settings.eligibleDishIds || [] });
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
      <div className="bo-panel-heading bo-loyalty-heading">
        <div>
          <p className="bo-eyebrow">Relation client</p>
          <h2>Fidélité et promotions</h2>
          <p className="bo-page-intro">Récompensez les clients qui reviennent chez Galatée.</p>
        </div>
        <Gift size={24} strokeWidth={1.5} aria-hidden="true" />
      </div>
      {alert && <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>}
      {state === "loading" && <p className="bo-empty">Chargement de la fidélité…</p>}
      {state === "error" && <p className="bo-empty">La fidélité n'a pas pu être chargée.</p>}
      {state === "ready" && settings && (
        <>
          <form className="bo-loyalty-settings" onSubmit={save}>
            <div className="bo-loyalty-settings-top">
              <div>
                <p className="bo-eyebrow">Règle actuelle</p>
                <h3>
                  {settings.active
                    ? `${settings.threshold} commandes · ${rewardLabel(settings)} · ${scopeLabel(settings, dishes)}`
                    : "Programme désactivé"}
                </h3>
              </div>
              <label className="bo-schedule-switch">
                <input
                  type="checkbox"
                  checked={settings.active}
                  onChange={(event) => change("active", event.target.checked)}
                />
                <span className="bo-schedule-switch-control" aria-hidden="true">✓</span>
                <span>Programme actif</span>
              </label>
            </div>

            <div className="bo-loyalty-fields">
              <label>
                Seuil de commandes
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.threshold}
                  onChange={(event) => change("threshold", event.target.value)}
                />
              </label>
              <label>
                Type de récompense
                <select
                  value={settings.rewardType}
                  onChange={(event) => change("rewardType", event.target.value)}
                >
                  <option value="percentage">Pourcentage</option>
                  <option value="fixed">Montant fixe en DA</option>
                </select>
              </label>
              <label>
                Application de la remise
                <select
                  value={settings.rewardScope || "items"}
                  onChange={(event) => change("rewardScope", event.target.value)}
                >
                  <option value="items">Plats éligibles présents</option>
                  <option value="pack">Pack complet</option>
                </select>
                <small className="bo-loyalty-value-help">
                  {settings.rewardScope === "pack"
                    ? "Tous les plats sélectionnés doivent être dans la commande."
                    : "La remise porte uniquement sur les plats éligibles présents."}
                </small>
              </label>
              <label>
                Valeur de la récompense
                <input
                  type="number"
                  min="1"
                  max={settings.rewardType === "percentage" ? "100" : "100000"}
                  value={settings.rewardValue}
                  onChange={(event) => change("rewardValue", event.target.value)}
                />
                <small className="bo-loyalty-value-help">
                  {settings.rewardType === "percentage"
                    ? "Calcul : prix initial − pourcentage = prix après remise."
                    : "Calcul : prix initial − montant en DA = prix après remise."}
                </small>
              </label>
              <label>
                Nom de la récompense
                <input
                  value={settings.title}
                  maxLength={120}
                  onChange={(event) => change("title", event.target.value)}
                />
              </label>
              <label>
                Expiration (jours)
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={settings.rewardExpirationDays ?? 90}
                  onChange={(event) => change("rewardExpirationDays", event.target.value)}
                  title="Nombre de jours avant qu'une récompense non utilisée expire. 0 = jamais."
                />
              </label>
              <label className="bo-loyalty-field-wide">
                Message client
                <textarea
                  rows="2"
                  maxLength={300}
                  value={settings.description}
                  onChange={(event) => change("description", event.target.value)}
                />
              </label>
            </div>

            <div className="bo-loyalty-scope">
              <div className="bo-loyalty-scope-head">
                <div>
                  <p className="bo-eyebrow">Portée de la remise</p>
                  <h4>Sur quels plats la remise s'applique</h4>
                </div>
                <div className="bo-loyalty-scope-toggle" role="tablist" aria-label="Portée de la remise">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scope === "all"}
                    className={`bo-loyalty-scope-tab ${scope === "all" ? "is-active" : ""}`}
                    onClick={selectAllDishes}
                  >
                    Tous les plats
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scope === "specific"}
                    className={`bo-loyalty-scope-tab ${scope === "specific" ? "is-active" : ""}`}
                    onClick={() => {
                      if (scope === "all" && dishes.length) {
                        change("eligibleDishIds", [dishes[0].id]);
                      }
                    }}
                  >
                    Plats sélectionnés
                  </button>
                </div>
              </div>

              {scope === "specific" && (
                <div className="bo-loyalty-dish-grid">
                  {dishes.length === 0 && (
                    <p className="bo-empty" style={{ margin: 0 }}>Aucun plat disponible.</p>
                  )}
                  {dishes.map((dish) => {
                    const title = dish.current?.title || dish.published?.title || "(sans titre)";
                    const price = dish.current?.priceCents != null
                      ? `${(dish.current.priceCents / 100).toLocaleString("fr-FR")} DA`
                      : "";
                    const checked = settings.eligibleDishIds?.includes(dish.id);
                    return (
                      <label
                        key={dish.id}
                        className={`bo-loyalty-dish ${checked ? "is-selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDish(dish.id)}
                        />
                        <span className="bo-loyalty-dish-check" aria-hidden="true">
                          <Check size={12} strokeWidth={2.5} />
                        </span>
                        <span className="bo-loyalty-dish-body">
                          <strong>{title}</strong>
                          {price && <small>{price}</small>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {settings.rewardScope === "pack" && settings.eligibleDishIds?.length < 2 && (
                <p className="bo-loyalty-pack-warning" role="alert">
                  Sélectionnez au moins 2 plats pour construire un pack.
                </p>
              )}

              {preview.items.length > 0 && !(settings.rewardScope === "pack" && settings.eligibleDishIds?.length < 2) && (
                <div className="bo-loyalty-preview" aria-live="polite">
                  <div>
                    <p className="bo-eyebrow">Aperçu du calcul</p>
                    <p>
                      {scope === "specific"
                        ? settings.rewardScope === "pack"
                          ? `Simulation du pack complet sur ${preview.items.length} plats.`
                          : `Simulation sur ${preview.items.length} article${preview.items.length > 1 ? "s" : ""} sélectionné${preview.items.length > 1 ? "s" : ""}.`
                        : "Simulation sur les articles actuels : la remise s'applique au sous-total éligible de la commande."}
                    </p>
                  </div>
                  <div className="bo-loyalty-preview-result">
                    <div className="bo-loyalty-preview-items">
                      {preview.items.map((item) => (
                        <span key={item.id}>{item.title} · {formatDzd(item.priceCents)}</span>
                      ))}
                    </div>
                    <div className="bo-loyalty-preview-equation">
                      <span>Sous-total initial</span>
                      <strong>{formatDzd(preview.initialCents)}</strong>
                      <span>− {settings.rewardType === "percentage" ? `${settings.rewardValue}% (${formatDzd(preview.discountCents)})` : formatDzd(Number(settings.rewardValue) * 100)}</span>
                      <strong>= {formatDzd(preview.afterCents)}</strong>
                    </div>
                    <small className="bo-loyalty-preview-final">Prix après remise</small>
                  </div>
                </div>
              )}
            </div>

            <div className="bo-loyalty-actions">
              <span>La récompense est créée lorsque la commande est confirmée par le restaurant.</span>
              <Button className="bo-schedule-save" size="sm" type="submit" disabled={busy}>
                <Save size={14} /> {busy ? "Enregistrement…" : "Enregistrer la règle"}
              </Button>
            </div>
          </form>

          <div className="bo-loyalty-customers">
            <div className="bo-section-heading">
              <div>
                <p className="bo-eyebrow">Suivi des membres</p>
                <h3>Progression des clients</h3>
              </div>
              <form
                className="bo-loyalty-search"
                onSubmit={(event) => { event.preventDefault(); load(search); }}
              >
                <Search size={15} />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nom, email ou téléphone"
                  aria-label="Rechercher un client"
                />
              </form>
            </div>
            {customers.length === 0 ? (
              <p className="bo-empty">Aucun client inscrit.</p>
            ) : (
              <div className="bo-loyalty-customer-list">
                {customers.map((customer) => {
                  const percent = customer.rewardAvailable
                    ? 100
                    : Math.min(100, (customer.progressInCycle / customer.settings.threshold) * 100);
                  return (
                    <article className="bo-loyalty-customer" key={customer.id}>
                      <div className="bo-loyalty-customer-name">
                        <span className="bo-loyalty-avatar"><Award size={15} /></span>
                        <div>
                          <strong>{customer.firstName} {customer.lastName}</strong>
                          <small>{customer.email}</small>
                        </div>
                      </div>
                      <div className="bo-loyalty-customer-progress">
                        <div>
                          <span>{customer.qualifyingOrders} commande{customer.qualifyingOrders > 1 ? "s" : ""}</span>
                          <strong>
                            {customer.rewardAvailable
                              ? customer.rewardAvailable.title
                              : `${customer.ordersToNextReward} restante${customer.ordersToNextReward > 1 ? "s" : ""}`}
                          </strong>
                        </div>
                        <span className="bo-loyalty-track"><i style={{ width: `${percent}%` }} /></span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
