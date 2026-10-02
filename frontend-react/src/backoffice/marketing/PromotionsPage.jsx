import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Percent, Save, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiMessage, apiRequest } from "../api";
import { calculatePromotionDiscountCents } from "@/lib/promotions";
import MarketingTabs from "./MarketingTabs.jsx";

const DEFAULT_FORM = {
  title: "",
  description: "",
  rewardType: "percentage",
  rewardValue: 10,
  scope: "items",
  targetIds: [],
  active: true,
};

function formatDzd(cents) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`;
}

function targetLabel(promotion, menu) {
  const titles = promotion.targetIds.map((id) => {
    const item = menu.find((entry) => entry.id === id);
    return item?.current?.title || item?.published?.title || id;
  });
  return titles.join(" + ");
}

export default function PromotionsPage({ onNavigate }) {
  const [promotions, setPromotions] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [promotionPayload, menuPayload] = await Promise.all([
        apiRequest("/admin/promotions"),
        apiRequest("/admin/menu"),
      ]);
      setPromotions(promotionPayload.promotions || []);
      setDishes(menuPayload.menu || []);
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger les promotions.") });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedDishes = useMemo(
    () => dishes.filter((dish) => form.targetIds.includes(dish.id)),
    [dishes, form.targetIds],
  );

  const preview = useMemo(() => {
    const items = selectedDishes.map((dish) => ({
      id: dish.id,
      title: dish.current?.title || dish.published?.title || "(sans titre)",
      priceCents: Math.max(0, Number(dish.current?.priceCents ?? dish.published?.priceCents ?? 0)),
    })).map((item) => {
      const discountCents = calculatePromotionDiscountCents(item.priceCents, form.rewardType, form.rewardValue);
      return { ...item, discountCents, afterCents: Math.max(0, item.priceCents - discountCents) };
    });
    const initialCents = items.reduce((sum, item) => sum + item.priceCents, 0);
    const discountCents = form.scope === "pack"
      ? calculatePromotionDiscountCents(initialCents, form.rewardType, form.rewardValue)
      : 0;
    return {
      items,
      initialCents,
      discountCents,
      afterCents: form.scope === "pack" ? Math.max(0, initialCents - discountCents) : null,
    };
  }, [form.rewardType, form.rewardValue, form.scope, selectedDishes]);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeScope(scope) {
    setForm((current) => ({ ...current, scope }));
  }

  function toggleTarget(id) {
    setForm((current) => {
      const targetIds = current.targetIds.includes(id)
        ? current.targetIds.filter((targetId) => targetId !== id)
        : [...current.targetIds, id];
      return { ...current, targetIds };
    });
  }

  async function createPromotion(event) {
    event.preventDefault();
    setBusy(true);
    setAlert(null);
    try {
      const payload = await apiRequest("/admin/promotions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          rewardValue: Number(form.rewardValue),
          targetIds: form.targetIds,
        }),
      });
      setPromotions((current) => [payload.promotion, ...current]);
      setForm(DEFAULT_FORM);
      setAlert({ kind: "success", message: "Promotion enregistrée et active." });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "La promotion n'a pas pu être enregistrée.") });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(promotion) {
    try {
      const payload = await apiRequest(`/admin/promotions/${encodeURIComponent(promotion.id)}`, { method: "DELETE" });
      setPromotions((current) => current.map((item) => item.id === promotion.id ? payload.promotion : item));
      setAlert({ kind: "success", message: "Promotion désactivée." });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "La promotion n'a pas pu être désactivée.") });
    }
  }

  return (
    <section className="bo-promotions-page">
      <MarketingTabs active="promotions" onNavigate={onNavigate} />
      <div className="bo-panel-heading bo-loyalty-heading">
        <div>
          <p className="bo-eyebrow">Ventes et animation</p>
          <h2>Promotions</h2>
          <p className="bo-page-intro">Crée des remises immédiates, indépendantes du programme fidélité.</p>
        </div>
        <Tag size={24} strokeWidth={1.5} aria-hidden="true" />
      </div>

      {alert && <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>}
      {state === "loading" && <p className="bo-empty">Chargement des promotions…</p>}
      {state === "error" && <p className="bo-empty">Les promotions n'ont pas pu être chargées.</p>}

      {state === "ready" && (
        <>
          <form className="bo-loyalty-settings bo-promotions-create" onSubmit={createPromotion}>
            <div className="bo-loyalty-settings-top">
              <div>
                <p className="bo-eyebrow">Nouvelle règle</p>
                <h3>Créer une promotion</h3>
              </div>
              <Percent size={20} strokeWidth={1.6} aria-hidden="true" />
            </div>
            <div className="bo-loyalty-fields bo-promotions-fields">
              <label>
                Nom de la promotion
                <input required maxLength={120} value={form.title} onChange={(event) => change("title", event.target.value)} placeholder="Ex. Carbonara du mardi" />
              </label>
              <label>
                Type de remise
                <select value={form.rewardType} onChange={(event) => change("rewardType", event.target.value)}>
                  <option value="percentage">Pourcentage</option>
                  <option value="fixed">Montant fixe en DA</option>
                </select>
              </label>
              <label>
                Montant
                <input type="number" min="1" max={form.rewardType === "percentage" ? "100" : "100000"} value={form.rewardValue} onChange={(event) => change("rewardValue", event.target.value)} />
              </label>
              <label className="bo-promotions-description">
                Message client
                <input maxLength={240} value={form.description} onChange={(event) => change("description", event.target.value)} placeholder="Optionnel" />
              </label>
            </div>

            <div className="bo-loyalty-scope">
              <div className="bo-loyalty-scope-head">
                <div>
                  <p className="bo-eyebrow">Portée de la remise</p>
                  <h4>{form.scope === "pack" ? "Sélectionne les plats du pack" : "Sélectionne les plats concernés"}</h4>
                </div>
                <div className="bo-loyalty-scope-toggle" role="tablist" aria-label="Portée de la promotion">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={form.scope === "items"}
                    className={`bo-loyalty-scope-tab ${form.scope === "items" ? "is-active" : ""}`}
                    onClick={() => changeScope("items")}
                  >
                    Plats individuellement
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={form.scope === "pack"}
                    className={`bo-loyalty-scope-tab ${form.scope === "pack" ? "is-active" : ""}`}
                    onClick={() => changeScope("pack")}
                  >
                    Un pack précis
                  </button>
                </div>
              </div>
              <small className="bo-loyalty-value-help">
                {form.scope === "pack"
                  ? "Tous les plats cochés devront être commandés pour appliquer la remise."
                  : "Chaque plat sélectionné reçoit cette remise individuellement. Pour des montants différents, crée une règle séparée."}
              </small>
              <div className="bo-loyalty-dish-grid">
                {dishes.map((dish) => {
                  const title = dish.current?.title || dish.published?.title || dish.id;
                  const priceCents = dish.current?.priceCents ?? dish.published?.priceCents ?? 0;
                  const checked = form.targetIds.includes(dish.id);
                  return (
                    <label key={dish.id} className={`bo-loyalty-dish ${checked ? "is-selected" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleTarget(dish.id)} />
                      <span className="bo-loyalty-dish-check" aria-hidden="true">
                        <Check size={12} strokeWidth={2.5} />
                      </span>
                      <span className="bo-loyalty-dish-body">
                        <strong>{title}</strong>
                        <small>{formatDzd(priceCents)}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            {selectedDishes.length > 0 && (
              <div className="bo-loyalty-preview bo-promotions-preview" aria-live="polite">
                <div>
                  <p className="bo-eyebrow">Aperçu du calcul</p>
                  <p>
                    {form.scope === "pack"
                      ? `Simulation du pack complet sur ${preview.items.length} plats.`
                      : `Simulation sur ${preview.items.length} plat${preview.items.length > 1 ? "s" : ""} sélectionné${preview.items.length > 1 ? "s" : ""}, individuellement.`}
                  </p>
                </div>
                <div className="bo-loyalty-preview-result">
                  {form.scope === "pack" ? (
                    <>
                      <div className="bo-loyalty-preview-items">
                        {preview.items.map((item) => (
                          <span key={item.id}>{item.title} · {formatDzd(item.priceCents)}</span>
                        ))}
                      </div>
                      <div className="bo-loyalty-preview-equation">
                        <span>Sous-total du pack</span>
                        <strong>{formatDzd(preview.initialCents)}</strong>
                        <span>− {form.rewardType === "percentage" ? `${form.rewardValue}% (${formatDzd(preview.discountCents)})` : formatDzd(Number(form.rewardValue) * 100)}</span>
                        <strong>= {formatDzd(preview.afterCents)}</strong>
                      </div>
                      <small className="bo-loyalty-preview-final">Prix du pack après remise</small>
                    </>
                  ) : (
                    <div className="bo-loyalty-preview-item-list">
                      {preview.items.map((item) => (
                        <div className="bo-loyalty-preview-item" key={item.id}>
                          <strong>{item.title}</strong>
                          <span>
                            {formatDzd(item.priceCents)} − {form.rewardType === "percentage" ? `${form.rewardValue}% (${formatDzd(item.discountCents)})` : formatDzd(Number(form.rewardValue) * 100)} = <b>{formatDzd(item.afterCents)}</b>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="bo-loyalty-actions">
              <span>{selectedDishes.length ? `${selectedDishes.length} plat${selectedDishes.length > 1 ? "s" : ""} sélectionné${selectedDishes.length > 1 ? "s" : ""}.` : "Sélectionne une cible pour continuer."}</span>
              <Button type="submit" disabled={busy || !selectedDishes.length}><Save size={14} /> {busy ? "Enregistrement…" : "Créer la promotion"}</Button>
            </div>
          </form>

          <section className="bo-loyalty-customers bo-promotions-list">
            <div className="bo-section-heading">
              <div>
                <p className="bo-eyebrow">Règles enregistrées</p>
                <h3>Promotions directes</h3>
              </div>
              <span className="bo-promotions-count">{promotions.filter((item) => item.active).length} active{promotions.filter((item) => item.active).length > 1 ? "s" : ""}</span>
            </div>
            {promotions.length === 0 ? (
              <p className="bo-empty">Aucune promotion directe pour le moment.</p>
            ) : (
              <div className="bo-promotions-rule-list">
                {promotions.map((promotion) => (
                  <article className={`bo-promotion-rule ${promotion.active ? "" : "is-inactive"}`} key={promotion.id}>
                    <div className="bo-promotion-rule-main">
                      <span className="bo-promotion-rule-icon"><Tag size={15} /></span>
                      <div>
                        <strong>{promotion.title}</strong>
                        <small>{promotion.scope === "pack" ? "Pack" : "Plat individuel"} · {targetLabel(promotion, dishes)}</small>
                      </div>
                    </div>
                    <strong className="bo-promotion-rule-value">−{promotion.rewardValue}{promotion.rewardType === "percentage" ? "%" : " DA"}</strong>
                    <span className={`bo-promotion-status ${promotion.active ? "is-active" : ""}`}>{promotion.active ? "Active" : "Inactive"}</span>
                    {promotion.active && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => deactivate(promotion)} aria-label={`Désactiver ${promotion.title}`}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
