import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Minus, Package, Plus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Reveal from "@/components/Reveal";
import { fetchCustomerOrders, fetchMenu, trackEvent } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { useCheckoutForm } from "@/context/CheckoutFormContext";
import PopCTA from "@/components/PopCTA";
import GlowCard from "@/components/GlowCard";
import DishImage from "@/components/DishImage";
import SEO from "@/components/SEO";

function formatDzd(cents) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`;
}

export default function OrderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { account } = useCustomerAuth();
  const { cart, set: setCartItem, replace: replaceCart } = useCart();
  const { form, update: updateForm } = useCheckoutForm();
  const toast = useToast();
  const [menu, setMenu] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    fetchMenu().then((items) => {
      if (cancelled) return;
      setMenu(items);
      const requested = searchParams.get("dish");
      const hasCart = Object.keys(cart || {}).length > 0;
      if (!hasCart) {
        const firstAvailable = items.find((item) => item.available);
        const selected = items.find((item) => item.id === requested && item.available) || firstAvailable;
        if (selected) replaceCart({ [selected.id]: 1 });
      } else if (requested && items.find((item) => item.id === requested && item.available) && !cart[requested]) {
        setCartItem(requested, 1);
      }
      setState("ready");
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [searchParams]);

  useEffect(() => {
    if (!account) return;
    fetchCustomerOrders().then((payload) => setLoyalty(payload.loyalty || null)).catch(() => setLoyalty(null));
  }, [account]);

  const lines = useMemo(
    () => menu.filter((item) => cart[item.id]).map((item) => ({ ...item, quantity: cart[item.id], lineTotal: item.priceCents * cart[item.id] })),
    [cart, menu]
  );
  const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  const reward = loyalty?.rewardAvailable;
  const discount = form.loyaltyRewardId && reward?.id === form.loyaltyRewardId
    ? reward.rewardType === "fixed" ? Math.min(subtotal, reward.rewardValue * 100) : Math.min(subtotal, Math.floor(subtotal * reward.rewardValue / 100))
    : 0;
  const totalEstimated = Math.max(0, subtotal - discount);

  function changeQuantity(id, delta) {
    const current = cart[id] || 0;
    const next = Math.max(0, current + delta);
    setCartItem(id, next);
    if (delta > 0) {
      const item = menu.find((m) => m.id === id);
      if (item) toast.success(`Ajouté · ${item.title}`);
    }
  }

  function goToContact() {
    if (!lines.length) {
      toast.error("Ajoutez au moins un article à votre commande.");
      return;
    }
    trackEvent("order_cart_confirmed");
    navigate("/commande/coordonnees");
  }

  if (state === "loading") return <div className="page page-order"><div className="pbg-page-shell pbg-dish-status">Chargement de la commande…</div></div>;
  if (state === "error") return <div className="page page-order"><div className="pbg-page-shell pbg-dish-status">La commande n'a pas pu être chargée.</div></div>;

  return (
    <div className="page page-order">
      <SEO
        title="Commander — Livraison ou retrait à Alger"
        description="Commandez vos pâtes fraîches Pasta by Galatée en ligne. Livraison à Alger ou retrait à Hydra. Paiement à la livraison, confirmation sous 24h."
        path="/commande"
      />
      {/* ═══ RÉCAP XL ═══ */}
      <section className="order-section order-section-summary">
        <div className="pbg-page-shell">
          <Reveal className="order-mini-head">
            <p className="order-mini-kicker">Commande · Étape 1 sur 2</p>
            <h1 className="order-mini-title">Ta sélection.</h1>
            <p className="order-mini-lede">Vérifie tes plats, puis on passe à tes coordonnées.</p>
          </Reveal>
        </div>
        <div className="pbg-page-shell order-layout">
          <Reveal className="order-summary">
            <header className="order-summary-head">
              <div>
                <p className="order-summary-eyebrow"><Package size={14} strokeWidth={1.8} /> Votre sélection</p>
                <h2 className="order-summary-title">{lines.length} article{lines.length > 1 ? "s" : ""}</h2>
              </div>
              <div className="order-summary-count">{(() => { const n = lines.reduce((s, l) => s + l.quantity, 0); return `${n} pièce${n > 1 ? "s" : ""}`; })()}</div>
            </header>

            {lines.length === 0 && (
              <div className="order-empty">
                <p>Votre panier est vide.</p>
                <Link to="/menu" className="pbg-btn pbg-btn-outline"><span>Voir la carte</span><ArrowUpRight size={14} /></Link>
              </div>
            )}

            {lines.length > 0 && (
              <ul className="order-cart-lines" aria-label="Articles">
                {lines.map((item) => (
                  <li className="order-cart-line" key={item.id}>
                    <div className="order-cart-line-media">
                      <DishImage dish={{ image: item.image, webpSrcSet: item.webpSrcSet, alt: item.title }} sizes="120px" />
                    </div>
                    <div className="order-cart-line-body">
                      <strong className="order-cart-line-title">{item.title}</strong>
                      <span className="order-cart-line-unit">{formatDzd(item.priceCents)} / unité</span>
                    </div>
                    <div className="order-cart-line-actions">
                      <div className="order-quantity" role="group" aria-label={`Quantité ${item.title}`}>
                        <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="Retirer"><Minus size={14} strokeWidth={2.2} /></button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="Ajouter"><Plus size={14} strokeWidth={2.2} /></button>
                      </div>
                      <span className="order-cart-line-total">{formatDzd(item.lineTotal)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {menu.filter((item) => item.available && !cart[item.id]).length > 0 && (
              <div className="order-add-list">
                <p className="order-add-list-title">+ Ajouter à la commande</p>
                <div className="order-add-list-chips">
                  {menu.filter((item) => item.available && !cart[item.id]).map((item) => (
                    <button key={item.id} type="button" onClick={() => changeQuantity(item.id, 1)}>
                      <Plus size={12} strokeWidth={2.5} />
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {reward && (
              <div className={`pbg-reward-card ${form.loyaltyRewardId ? "is-applied" : ""}`}>
                <label className="pbg-reward-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(form.loyaltyRewardId)}
                    onChange={(event) => updateForm("loyaltyRewardId", event.target.checked ? reward.id : "")}
                  />
                  <span className="pbg-reward-body">
                    <span className="pbg-reward-badge">
                      {reward.rewardType === "fixed" ? `−${reward.rewardValue} DA` : `−${reward.rewardValue}%`}
                    </span>
                    <span className="pbg-reward-text">
                      <strong>🎁 {reward.title}</strong>
                      <small>
                        {form.loyaltyRewardId
                          ? `Vous économisez ${formatDzd(discount)} sur cette commande`
                          : "Cochez pour appliquer votre récompense fidélité"}
                      </small>
                    </span>
                  </span>
                </label>
              </div>
            )}

            <div className="order-totals">
              <p>
                <span>Sous-total</span>
                {discount > 0
                  ? <strong className="pbg-total-before"><s>{formatDzd(subtotal)}</s> {formatDzd(subtotal - discount)}</strong>
                  : <strong>{formatDzd(subtotal)}</strong>}
              </p>
              <p><span>Livraison</span><strong>À l'étape suivante</strong></p>
              {discount > 0 && (
                <p className="order-totals-discount">
                  <span>Récompense fidélité{reward?.rewardType === "percentage" && ` (−${reward.rewardValue}%)`}</span>
                  <strong>− {formatDzd(discount)}</strong>
                </p>
              )}
              <p className="order-total">
                <span>Total estimé</span>
                <strong>{formatDzd(totalEstimated)}</strong>
              </p>
            </div>

            <div className="order-confirm-row">
              <PopCTA type="button" onClick={goToContact} disabled={lines.length === 0}>
                <span>Confirmer ma sélection</span>
                <ArrowUpRight size={14} strokeWidth={2} />
              </PopCTA>
              <Link to="/menu" className="order-confirm-back">← Modifier la carte</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ Sticky mobile bottom bar ═══ */}
      {lines.length > 0 && (
        <div className="order-sticky-bar">
          <div className="order-sticky-total">
            <span>Total estimé</span>
            <strong>{formatDzd(totalEstimated)}</strong>
          </div>
          <button type="button" className="order-sticky-cta" onClick={goToContact}>
            Confirmer
            <ArrowUpRight size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
