import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Reveal from "@/components/Reveal";
import { createOrder, fetchCustomerOrders, fetchDeliveryCommunes, fetchMenu, trackEvent } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

const EMPTY_FORM = { firstName: "", lastName: "", phone: "", email: "", deliveryMode: "delivery", communeId: "", deliveryAddress: "", note: "", loyaltyRewardId: "" };

function formatDzd(cents) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`;
}

export default function OrderPage() {
  const [searchParams] = useSearchParams();
  const { account } = useCustomerAuth();
  const [menu, setMenu] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [cart, setCart] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMenu(), fetchDeliveryCommunes()]).then(([items, deliveryCommunes]) => {
      if (cancelled) return;
      setMenu(items);
      setCommunes(deliveryCommunes || []);
      const requested = searchParams.get("dish");
      const firstAvailable = items.find((item) => item.available);
      const selected = items.find((item) => item.id === requested && item.available) || firstAvailable;
      if (selected) setCart({ [selected.id]: 1 });
      setState("ready");
    }).catch(() => { if (!cancelled) { setState("error"); setError("La commande n'a pas pu être chargée."); } });
    return () => { cancelled = true; };
  }, [searchParams]);

  useEffect(() => {
    if (!account) return;
    setForm((current) => ({ ...current, firstName: current.firstName || account.firstName, lastName: current.lastName || account.lastName, phone: current.phone || account.phone, email: current.email || account.email }));
    fetchCustomerOrders().then((payload) => setLoyalty(payload.loyalty || null)).catch(() => setLoyalty(null));
  }, [account]);

  const lines = useMemo(() => menu.filter((item) => cart[item.id]).map((item) => ({ ...item, quantity: cart[item.id], lineTotal: item.priceCents * cart[item.id] })), [cart, menu]);
  const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  const selectedCommune = communes.find((commune) => commune.id === form.communeId);
  const deliveryFee = form.deliveryMode === "delivery" ? (selectedCommune?.feeCents || 0) : 0;
  const reward = loyalty?.rewardAvailable;
  const discount = form.loyaltyRewardId && reward?.id === form.loyaltyRewardId
    ? reward.rewardType === "fixed" ? Math.min(subtotal, reward.rewardValue * 100) : Math.min(subtotal, Math.floor(subtotal * reward.rewardValue / 100))
    : 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  function updateForm(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  function changeQuantity(id, delta) { setCart((current) => ({ ...current, [id]: Math.max(0, (current[id] || 0) + delta) })); }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!lines.length) { setError("Ajoutez au moins un article à votre commande."); return; }
    setState("submitting");
    try {
      const payload = await createOrder({ ...form, loyaltyRewardId: form.loyaltyRewardId || undefined, items: lines.map((item) => ({ productId: item.id, productType: item.productType || "dish", quantity: item.quantity })) });
      setSubmitted(payload.order);
      trackEvent("order_submitted");
    } catch (submitError) {
      setError(submitError.code === "PRODUCT_UNAVAILABLE" ? "Un article vient de passer en rupture. Actualisez la carte et réessayez." : submitError.message || "La commande n'a pas pu être envoyée.");
      setState("ready");
    }
  }

  if (state === "loading") return <div className="page page-order pbg-page pbg-page-cream"><div className="pbg-page-shell pbg-dish-status">Chargement de la commande…</div></div>;
  if (state === "error") return <div className="page page-order pbg-page pbg-page-cream"><div className="pbg-page-shell pbg-dish-status">{error}</div></div>;
  if (submitted) return (
    <div className="page page-order pbg-page pbg-page-cream">
      <section className="pbg-page-header"><div className="pbg-page-shell"><p className="pbg-page-kicker"><span>Commande reçue</span></p><h1 className="pbg-page-title">À très<br /><em>bientôt.</em></h1><p className="pbg-page-lede">Votre commande est en attente de confirmation. L'équipe vous appellera au {submitted.phone}.</p></div></section>
      <section className="pbg-page-shell order-success"><div className="order-success-mark"><Check size={24} /></div><p>Paiement à la {submitted.deliveryMode === "delivery" ? "livraison" : "récupération"} uniquement.</p><Link className="pbg-btn pbg-btn-primary" to="/menu"><span>Retour à la carte</span><ArrowUpRight size={15} /></Link></section>
    </div>
  );

  return (
    <div className="page page-order pbg-page pbg-page-cream">
      <section className="pbg-page-header"><div className="pbg-page-shell"><p className="pbg-page-kicker"><span>La commande Galatee</span></p><h1 className="pbg-page-title">À votre<br /><em>table, chez vous.</em></h1><p className="pbg-page-lede">Choisissez vos pâtes fraîches, puis indiquez si vous préférez être livré à Alger ou récupérer votre commande.</p></div></section>
      <section className="pbg-page-shell order-layout">
        <Reveal className="order-summary">
          <div className="order-section-heading"><p className="pbg-page-kicker"><span><ShoppingBag size={14} /> Votre sélection</span></p><span>{lines.length} article{lines.length > 1 ? "s" : ""}</span></div>
          <div className="order-cart-lines">
            {lines.map((item) => <div className="order-cart-line" key={item.id}><img src={item.image} alt="" /><div><strong>{item.title}</strong><span>{formatDzd(item.priceCents)} / unité</span></div><div className="order-quantity"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Retirer ${item.title}`}><Minus size={13} /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Ajouter ${item.title}`}><Plus size={13} /></button></div></div>)}
          </div>
          <div className="order-add-list"><span>Ajouter à la commande</span>{menu.filter((item) => item.available && !cart[item.id]).map((item) => <button type="button" key={item.id} onClick={() => changeQuantity(item.id, 1)}><Plus size={13} /> {item.title}</button>)}</div>
          {reward && <label className="order-reward-option"><input type="checkbox" checked={Boolean(form.loyaltyRewardId)} onChange={(event) => updateForm("loyaltyRewardId", event.target.checked ? reward.id : "")} /><span><strong>{reward.title}</strong><small>Votre récompense fidélité est disponible</small></span></label>}
          <div className="order-totals"><p><span>Sous-total</span><strong>{formatDzd(subtotal)}</strong></p><p><span>Livraison</span><strong>{form.deliveryMode === "delivery" ? (selectedCommune ? formatDzd(deliveryFee) : "Selon commune") : "Retrait sur place"}</strong></p>{discount > 0 && <p><span>Récompense</span><strong>- {formatDzd(discount)}</strong></p>}<p className="order-total"><span>Total estimé</span><strong>{formatDzd(total)}</strong></p></div>
        </Reveal>
        <Reveal className="order-form-wrap" delay={100}>
          <form className="order-form" onSubmit={submit}><p className="pbg-page-kicker"><span>Vos coordonnées</span></p><div className="order-form-row"><label>Prénom<input value={form.firstName} onChange={(e) => updateForm("firstName", e.target.value)} required /></label><label>Nom<input value={form.lastName} onChange={(e) => updateForm("lastName", e.target.value)} required /></label></div><div className="order-form-row"><label>Téléphone<input type="tel" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} required /></label><label>Email <small>optionnel</small><input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} /></label></div><label>Mode de réception<select value={form.deliveryMode} onChange={(e) => updateForm("deliveryMode", e.target.value)}><option value="delivery">Livraison à Alger</option><option value="pickup">Retrait chez Galatee</option></select></label>{form.deliveryMode === "delivery" && <><label>Commune<select value={form.communeId} onChange={(e) => updateForm("communeId", e.target.value)} required><option value="">Choisir une commune</option>{communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.name} · {formatDzd(commune.feeCents)}</option>)}</select></label><label>Adresse de livraison<textarea rows={3} value={form.deliveryAddress} onChange={(e) => updateForm("deliveryAddress", e.target.value)} required /></label></>}<label>Note <small>optionnel</small><textarea rows={2} value={form.note} onChange={(e) => updateForm("note", e.target.value)} placeholder="Une précision pour l'équipe…" /></label>{error && <p className="order-error" role="alert">{error}</p>}<button className="pbg-btn pbg-btn-primary order-submit" type="submit" disabled={state === "submitting"}><span>{state === "submitting" ? "Envoi en cours…" : "Envoyer ma commande"}</span><ArrowUpRight size={16} /></button><p className="order-payment-note">Paiement à la {form.deliveryMode === "delivery" ? "livraison" : "récupération"}. L'équipe vous appelle pour confirmer la commande.</p></form>
        </Reveal>
      </section>
    </div>
  );
}
