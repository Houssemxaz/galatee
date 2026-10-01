import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, MapPin, Store, Truck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import DeliveryLocationPicker from "@/components/DeliveryLocationPicker";
import Reveal from "@/components/Reveal";
import ShineCTA from "@/components/ShineCTA";
import SEO from "@/components/SEO";
import { createOrder, fetchCustomerOrders, fetchDeliveryCommunes, fetchMenu, trackEvent } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { useCheckoutForm } from "@/context/CheckoutFormContext";

function formatDzd(cents) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`;
}

export default function CheckoutContactPage() {
  const navigate = useNavigate();
  const { account } = useCustomerAuth();
  const { cart, clear: clearCart } = useCart();
  const { form, update: updateForm, merge: mergeForm, reset: resetForm } = useCheckoutForm();
  const toast = useToast();
  const [menu, setMenu] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMenu(), fetchDeliveryCommunes()]).then(([items, deliveryCommunes]) => {
      if (cancelled) return;
      setMenu(items);
      setCommunes(deliveryCommunes || []);
      setState("ready");
    }).catch(() => { if (!cancelled) { setState("error"); setError("La commande n'a pas pu être chargée."); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!account) return;
    mergeForm({
      firstName: form.firstName || account.firstName || "",
      lastName: form.lastName || account.lastName || "",
      phone: form.phone || account.phone || "",
      email: form.email || account.email || "",
    });
    fetchCustomerOrders().then((payload) => setLoyalty(payload.loyalty || null)).catch(() => setLoyalty(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const lines = useMemo(
    () => menu.filter((item) => cart[item.id]).map((item) => ({ ...item, quantity: cart[item.id], lineTotal: item.priceCents * cart[item.id] })),
    [cart, menu]
  );
  const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  const selectedCommune = communes.find((commune) => commune.id === form.communeId);
  const deliveryFee = form.deliveryMode === "delivery" ? (selectedCommune?.feeCents || 0) : 0;
  const reward = loyalty?.rewardAvailable;
  const eligibleIds = loyalty?.settings?.eligibleDishIds || [];
  const eligibleSubtotal = eligibleIds.length
    ? lines.filter((item) => eligibleIds.includes(item.id)).reduce((sum, item) => sum + item.lineTotal, 0)
    : subtotal;
  const discount = form.loyaltyRewardId && reward?.id === form.loyaltyRewardId
    ? reward.rewardType === "fixed"
      ? Math.min(eligibleSubtotal, reward.rewardValue * 100)
      : Math.min(eligibleSubtotal, Math.floor(eligibleSubtotal * reward.rewardValue / 100))
    : 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  // Redirect back to /commande if the cart is empty (deep-linked with nothing to buy).
  useEffect(() => {
    if (state === "ready" && !submitted && lines.length === 0) {
      navigate("/commande", { replace: true });
    }
  }, [state, lines.length, submitted, navigate]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!lines.length) { setError("Ajoutez au moins un article à votre commande."); return; }
    setState("submitting");
    try {
      const payload = await createOrder({
        ...form,
        loyaltyRewardId: form.loyaltyRewardId || undefined,
        items: lines.map((item) => ({ productId: item.id, productType: item.productType || "dish", quantity: item.quantity })),
      });
      setSubmitted(payload.order);
      trackEvent("order_submitted");
      clearCart();
      resetForm();
      toast.success("Commande envoyée — l'équipe vous rappelle sous peu");
    } catch (submitError) {
      const msg = submitError.code === "PRODUCT_UNAVAILABLE"
        ? "Un article vient de passer en rupture. Actualisez la carte et réessayez."
        : submitError.message || "La commande n'a pas pu être envoyée.";
      setError(msg);
      toast.error(msg);
      setState("ready");
    }
  }

  if (state === "loading") return <div className="page page-order"><div className="pbg-page-shell pbg-dish-status">Chargement…</div></div>;
  if (state === "error") return <div className="page page-order"><div className="pbg-page-shell pbg-dish-status">{error}</div></div>;

  if (submitted) return (
    <div className="page page-order">
      <section className="order-hero">
        <div className="pbg-page-shell">
          <Reveal className="order-hero-copy">
            <div className="pbg-section-index pbg-section-index-light">
              <span>✓</span><i />Commande reçue
            </div>
            <h1 className="order-hero-title">À très<br /><em>bientôt.</em></h1>
            <p className="order-hero-lede">
              Votre commande est en attente de confirmation. L'équipe vous appellera au <b>{submitted.phone}</b> pour valider.
            </p>
          </Reveal>
        </div>
      </section>
      <section className="order-success">
        <div className="pbg-page-shell">
          <div className="order-success-card">
            <div className="order-success-mark"><Check size={22} strokeWidth={2.2} /></div>
            <p>Paiement à la {submitted.deliveryMode === "delivery" ? "livraison" : "récupération"} uniquement.</p>
            <Link className="pbg-btn pbg-btn-primary" to="/menu">
              <span>Retour à la carte</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="page page-order">
      <SEO
        title="Finaliser la commande — Coordonnées"
        description="Renseignez vos coordonnées pour finaliser votre commande Pasta by Galatée. Livraison ou retrait à Alger."
        path="/commande/coordonnees"
        noIndex
      />
      {/* ═══ FORM ═══ */}
      <section className="order-section order-section-form">
        <div className="pbg-page-shell">
          <Reveal className="order-mini-head">
            <p className="order-mini-kicker">Commande · Étape 2 sur 2</p>
            <h1 className="order-mini-title">Tes coordonnées.</h1>
            <p className="order-mini-lede">Panier <b>{formatDzd(subtotal)}</b> · plus qu'à confirmer.</p>
          </Reveal>
          <Reveal className="order-form-wrap" delay={80}>
            <header className="order-form-head">
              <p className="order-form-eyebrow">Coordonnées</p>
              <h2 className="order-form-title">On vous rappelle où ?</h2>
            </header>

            <form className="order-form" onSubmit={submit}>
              <div className="order-form-row">
                <label>
                  <span>Prénom</span>
                  <input value={form.firstName} onChange={(e) => updateForm("firstName", e.target.value)} required />
                </label>
                <label>
                  <span>Nom</span>
                  <input value={form.lastName} onChange={(e) => updateForm("lastName", e.target.value)} required />
                </label>
              </div>
              <div className="order-form-row">
                <label>
                  <span>Téléphone</span>
                  <input type="tel" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} required />
                </label>
                <label>
                  <span>Email <small>optionnel</small></span>
                  <input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} />
                </label>
              </div>

              <fieldset className="order-mode-picker">
                <legend>Mode de réception</legend>
                <div className="order-mode-options">
                  <label className={`order-mode-option ${form.deliveryMode === "delivery" ? "is-active" : ""}`}>
                    <input type="radio" name="deliveryMode" value="delivery" checked={form.deliveryMode === "delivery"} onChange={(e) => updateForm("deliveryMode", e.target.value)} />
                    <span className="order-mode-icon"><Truck size={22} strokeWidth={1.6} /></span>
                    <span className="order-mode-label">Livraison</span>
                    <span className="order-mode-note">À Alger, selon commune</span>
                  </label>
                  <label className={`order-mode-option ${form.deliveryMode === "pickup" ? "is-active" : ""}`}>
                    <input type="radio" name="deliveryMode" value="pickup" checked={form.deliveryMode === "pickup"} onChange={(e) => updateForm("deliveryMode", e.target.value)} />
                    <span className="order-mode-icon"><Store size={22} strokeWidth={1.6} /></span>
                    <span className="order-mode-label">Retrait sur place</span>
                    <span className="order-mode-note">Hydra, Alger</span>
                  </label>
                </div>
              </fieldset>

              {form.deliveryMode === "delivery" && (
                <>
                  <label>
                    <span><MapPin size={12} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Commune</span>
                    <select value={form.communeId} onChange={(e) => updateForm("communeId", e.target.value)} required>
                      <option value="">Choisir une commune</option>
                      {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.name} · {formatDzd(commune.feeCents)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Adresse de livraison</span>
                    <textarea rows={3} value={form.deliveryAddress} onChange={(e) => updateForm("deliveryAddress", e.target.value)} required placeholder="Rue, immeuble, étage, digicode…" />
                  </label>
                  <DeliveryLocationPicker
                    latitude={form.deliveryLatitude}
                    longitude={form.deliveryLongitude}
                    onChange={({ latitude, longitude }) => mergeForm({ deliveryLatitude: latitude, deliveryLongitude: longitude })}
                  />
                </>
              )}

              <label>
                <span>Note <small>optionnel</small></span>
                <textarea rows={2} value={form.note} onChange={(e) => updateForm("note", e.target.value)} placeholder="Une précision pour l'équipe…" />
              </label>

              {/* Recap intégré au formulaire */}
              <div className="order-inline-recap">
                <p>
                  <span>Sous-total</span>
                  <strong>{formatDzd(subtotal)}</strong>
                </p>
                <p><span>Livraison</span><strong>{form.deliveryMode === "delivery" ? (selectedCommune ? formatDzd(deliveryFee) : "Selon commune") : "Retrait sur place"}</strong></p>
                {discount > 0 && (
                  <p className="order-inline-discount">
                    <span>
                      🎁 Récompense fidélité
                      {reward?.rewardType === "percentage" && ` (−${reward.rewardValue}%)`}
                      {reward?.rewardType === "fixed" && ` (−${reward.rewardValue} DA)`}
                    </span>
                    <strong>− {formatDzd(discount)}</strong>
                  </p>
                )}
                <p className="order-inline-total">
                  <span>Total</span>
                  {discount > 0
                    ? <strong className="pbg-total-with-discount">
                        <s>{formatDzd(subtotal + deliveryFee)}</s>
                        <em>{formatDzd(total)}</em>
                      </strong>
                    : <strong>{formatDzd(total)}</strong>}
                </p>
              </div>

              {error && <p className="order-error" role="alert">{error}</p>}

              <ShineCTA className="pbg-btn pbg-btn-primary order-submit" type="submit" disabled={state === "submitting"}>
                <span>{state === "submitting" ? "Envoi en cours…" : "Envoyer ma commande"}</span>
                <ArrowUpRight size={16} />
              </ShineCTA>

              <p className="order-payment-note">
                Paiement à la {form.deliveryMode === "delivery" ? "livraison" : "récupération"} — en espèces. L'équipe vous appelle pour confirmer.
              </p>

              <Link to="/commande" className="order-contact-back">
                <ArrowLeft size={14} strokeWidth={2} />
                <span>Modifier ma sélection</span>
              </Link>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ═══ Sticky mobile bottom bar ═══ */}
      <div className="order-sticky-bar">
        <div className="order-sticky-total">
          <span>Total</span>
          <strong>{formatDzd(total)}</strong>
        </div>
        <button
          type="button"
          className="order-sticky-cta"
          onClick={() => document.querySelector(".order-submit")?.scrollIntoView({ behavior: "smooth", block: "center" })}
        >
          Valider
          <ArrowUpRight size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
