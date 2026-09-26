import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, Gift, Repeat2, Utensils } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Reveal from "@/components/Reveal";
import SEO from "@/components/SEO";
import { fetchCustomerOrders } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useCart } from "@/context/CartContext";

const ORDER_STATUS_LABELS = {
  pending: "À confirmer",
  confirmed: "Confirmée",
  cancelled: "Annulée",
  preparing: "En prépa",
  ready: "Prête",
  delivered: "Livrée",
  withdrawn: "Retirée",
  completed: "Terminée",
};

function formatCurrency(cents) {
  if (typeof cents !== "number") return "";
  return `${(cents / 100).toLocaleString("fr-FR")} DA`;
}

function LoyaltyStampCard({ loyalty }) {
  const threshold = loyalty?.settings?.threshold || 10;
  const reward = loyalty?.rewardAvailable;
  // Quand une recompense est disponible, la carte doit afficher un cycle
  // complet (10/10) meme si progressInCycle est retombe a 0 apres modulo.
  const progress = reward ? threshold : Math.min(threshold, loyalty?.progressInCycle || 0);
  const remaining = Math.max(0, threshold - progress);
  const stamps = Array.from({ length: threshold }, (_, i) => i < progress);

  return (
    <div className={`pbg-stamp-card ${reward ? "is-reward" : ""}`}>
      <p className="pbg-stamp-eyebrow">
        <Gift size={12} strokeWidth={2} />
        <span>Programme fidélité</span>
      </p>

      <h2 className="pbg-stamp-headline">
        {reward
          ? <>Votre récompense<br /><em>vous attend.</em></>
          : progress === 0
            ? <>Chaque plat<br /><em>compte.</em></>
            : <>Plus que <em>{remaining} plat{remaining > 1 ? "s" : ""}</em><br />avant la promo.</>}
      </h2>

      <div className="pbg-stamp-counter">
        <span className="pbg-stamp-progress">{progress}</span>
        <span className="pbg-stamp-slash">/</span>
        <span className="pbg-stamp-total">{threshold}</span>
      </div>

      <div className="pbg-stamp-grid" role="img" aria-label={`${progress} commandes sur ${threshold}`}>
        {stamps.map((filled, i) => (
          <span
            key={i}
            className={`pbg-stamp-dot ${filled ? "is-filled" : ""}`}
            style={{ transitionDelay: filled ? `${i * 50}ms` : "0ms" }}
          >
            <Utensils size={14} strokeWidth={2} />
          </span>
        ))}
      </div>

      <p className="pbg-stamp-reward">
        {reward
          ? reward.title
          : "À 10 plats commandés, un dessert offert à la maison."}
      </p>

      <Link to="/commande" className="pbg-btn pbg-btn-primary pbg-stamp-cta">
        <span>Passer une commande</span>
        <ArrowUpRight size={16} strokeWidth={1.6} />
      </Link>
    </div>
  );
}

function OrderCard({ order, onReorder, disabled }) {
  const items = order.items || [];
  const itemsPreview = items.map((it) => `${it.quantity} × ${it.title}`).join(" · ");
  const dateLabel = new Date(order.createdAt).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <article className="pbg-order-card">
      <header className="pbg-order-card-head">
        <div>
          <p className="pbg-order-card-date">{dateLabel}</p>
          <h3 className="pbg-order-card-title">
            {order.deliveryMode === "delivery" ? `Livraison · ${order.communeName || "Alger"}` : "Retrait chez Galatée"}
          </h3>
        </div>
        <span className={`pbg-order-badge is-${order.status}`}>
          {ORDER_STATUS_LABELS[order.status] || order.status}
        </span>
      </header>

      <ul className="pbg-order-card-items">
        {items.map((it, i) => (
          <li key={i}>
            <span className="pbg-order-card-qty">{it.quantity}×</span>
            <span className="pbg-order-card-name">{it.title}</span>
            <span className="pbg-order-card-price">{it.lineTotal || formatCurrency(it.lineTotalCents)}</span>
          </li>
        ))}
      </ul>

      <footer className="pbg-order-card-foot">
        <div className="pbg-order-card-total">
          <span>Total</span>
          <strong>{order.total || formatCurrency(order.totalCents)}</strong>
        </div>
        <button
          type="button"
          className="pbg-order-reorder"
          onClick={() => onReorder(order)}
          disabled={disabled || items.length === 0}
        >
          <Repeat2 size={15} strokeWidth={1.9} />
          <span>Commander la même chose</span>
        </button>
      </footer>
    </article>
  );
}

export default function OrdersHistoryPage() {
  const { account, loading } = useCustomerAuth();
  const { replace: replaceCart } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [state, setState] = useState("idle");

  useEffect(() => {
    if (!account) return undefined;
    let cancelled = false;
    setState("loading");
    fetchCustomerOrders()
      .then((payload) => {
        if (cancelled) return;
        setOrders(payload.orders || []);
        setLoyalty(payload.loyalty || null);
        setState("ready");
      })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [account]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders]);

  function reorder(order) {
    const nextCart = {};
    (order.items || []).forEach((it) => {
      const id = it.productId;
      if (!id) return;
      nextCart[id] = (nextCart[id] || 0) + (it.quantity || 1);
    });
    if (Object.keys(nextCart).length === 0) return;
    replaceCart(nextCart);
    navigate("/commande");
  }

  if (loading) {
    return (
      <div className="page pbg-page pbg-orders-page">
        <div className="pbg-page-shell"><p className="account-loading">Chargement…</p></div>
      </div>
    );
  }
  if (!account) return <Navigate to="/compte" replace />;

  return (
    <div className="page pbg-page pbg-orders-page">
      <SEO
        title="Mes commandes"
        description="Progression de votre programme fidélité et historique de vos commandes Pasta by Galatée."
        path="/compte/commandes"
        noIndex
      />

      <section className="pbg-orders-hero">
        <div className="pbg-page-shell">
          <Link to="/compte" className="pbg-orders-back">
            <ChevronLeft size={16} strokeWidth={1.8} />
            <span>Retour à mon compte</span>
          </Link>
        </div>
      </section>

      <section className="pbg-stamp-body">
        <div className="pbg-page-shell">
          <Reveal>
            {state === "ready" && <LoyaltyStampCard loyalty={loyalty} />}
            {state === "loading" && <p className="account-state">Chargement de votre carte fidélité…</p>}
            {state === "error" && <p className="account-state account-state-error">Impossible de charger votre carte fidélité.</p>}
          </Reveal>
        </div>
      </section>

      {state === "ready" && sortedOrders.length > 0 && (
        <section className="pbg-orders-list-section">
          <div className="pbg-page-shell">
            <Reveal>
              <div className="pbg-orders-list-head">
                <p className="pbg-orders-list-eyebrow">Historique</p>
                <h2 className="pbg-orders-list-title">Vos commandes.</h2>
                <p className="pbg-orders-list-lede">
                  Une envie de retrouver la même chose ? Un clic suffit.
                </p>
              </div>
            </Reveal>

            <div className="pbg-orders-list">
              {sortedOrders.map((order, i) => (
                <Reveal key={order.id} delay={i * 60}>
                  <OrderCard order={order} onReorder={reorder} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
