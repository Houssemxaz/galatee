import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, Bike, CheckCircle2, LogOut, MapPin, Package, Phone, RefreshCw,
  X, ArrowUpRight, Undo2,
} from "lucide-react";
import {
  cancelOrder, deliverOrder, driverLogout, fetchDriverOrders, fetchDriverPool,
  releaseOrder, startDelivery, takeOrder, updateDriverStatus,
} from "./api";
import { orderMapsHref } from "@/lib/maps";

const POLL_INTERVAL_MS = 8000;

const STATUS_LABEL = {
  confirmed: "Confirmée",
  ready: "Prête à récupérer",
};

const CANCEL_REASONS = [
  { value: "customer_unreachable", label: "Client injoignable" },
  { value: "wrong_address", label: "Adresse incorrecte" },
  { value: "customer_refused", label: "Client refuse la commande" },
  { value: "other", label: "Autre motif" },
];

const REASON_LABEL = Object.fromEntries(CANCEL_REASONS.map((r) => [r.value, r.label]));

function formatDzd(cents) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`;
}

export default function DriverHomePage({ driver, onDriverUpdated, onLoggedOut }) {
  const [pool, setPool] = useState([]);
  const [orders, setOrders] = useState([]);
  const [state, setState] = useState("loading");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(null);
  const [deliverDialog, setDeliverDialog] = useState(null);

  const load = useCallback(async () => {
    try {
      const [poolPayload, ordersPayload] = await Promise.all([
        fetchDriverPool(),
        fetchDriverOrders(),
      ]);
      setPool(poolPayload.pool || []);
      setOrders(ordersPayload.orders || []);
      setState("ready");
    } catch (error) {
      if (error.status === 401) onLoggedOut();
      setState("error");
    }
  }, [onLoggedOut]);

  useEffect(() => { load(); }, [load]);

  // Polling toutes les 8s, seulement quand la page est visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  function flash(kind, message) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function toggleStatus() {
    const nextStatus = driver.currentStatus === "available" || driver.currentStatus === "busy"
      ? "offline"
      : "available";
    try {
      const payload = await updateDriverStatus(nextStatus);
      onDriverUpdated(payload.driver);
      flash("success", nextStatus === "available" ? "Vous êtes en ligne." : "Vous êtes en pause.");
    } catch (error) {
      flash("error", error.message || "Impossible de mettre à jour le statut.");
    }
  }

  async function handleLogout() {
    try { await driverLogout(); } catch { /* ignore */ }
    onLoggedOut();
  }

  async function handleTake(order) {
    setBusyId(order.id);
    try {
      await takeOrder(order.id);
      await load();
      flash("success", `Course #${order.orderNumber.split("-").pop()} prise !`);
    } catch (error) {
      flash("error", error.message || "Impossible de prendre cette course.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRelease(order) {
    if (!window.confirm("Relâcher cette course ? Elle repart dans le pool des autres livreurs.")) return;
    setBusyId(order.id);
    try {
      await releaseOrder(order.id);
      await load();
      flash("success", "Course relâchée.");
    } catch (error) {
      flash("error", error.message || "Impossible de relâcher.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStart(order) {
    setBusyId(order.id);
    try {
      await startDelivery(order.id);
      await load();
      flash("success", "En route !");
    } catch (error) {
      flash("error", error.message || "Impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeliver() {
    if (!deliverDialog) return;
    const order = deliverDialog.order;
    setBusyId(order.id);
    try {
      await deliverOrder(order.id);
      setDeliverDialog(null);
      await load();
      flash("success", "Livrée et encaissée ✅");
    } catch (error) {
      flash("error", error.message || "Impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitCancel(event) {
    event.preventDefault();
    if (!cancelDialog) return;
    const reasonLabel = cancelDialog.reason === "other" ? cancelDialog.custom : REASON_LABEL[cancelDialog.reason];
    if (!reasonLabel) {
      flash("error", "Choisissez un motif d'annulation.");
      return;
    }
    setBusyId(cancelDialog.order.id);
    try {
      await cancelOrder(cancelDialog.order.id, reasonLabel);
      setCancelDialog(null);
      await load();
      flash("success", "Course annulée.");
    } catch (error) {
      flash("error", error.message || "Impossible d'annuler.");
    } finally {
      setBusyId(null);
    }
  }

  const isOnline = driver.currentStatus === "available" || driver.currentStatus === "busy";

  return (
    <>
      <header className="pbg-drv-header">
        <div>
          <p className="pbg-drv-hello">Salut,</p>
          <p className="pbg-drv-firstname">{driver.firstName}</p>
        </div>
        <div className="pbg-drv-header-actions">
          <Link to="/livreur/stats" className="pbg-drv-icon-btn" aria-label="Mes statistiques">
            <BarChart3 size={18} strokeWidth={1.8} />
          </Link>
          <button type="button" className="pbg-drv-icon-btn" onClick={handleLogout} aria-label="Se déconnecter">
            <LogOut size={18} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <button
        type="button"
        className={`pbg-drv-status-toggle ${isOnline ? "is-online" : "is-off"}`}
        onClick={toggleStatus}
      >
        <span className="pbg-drv-status-dot" aria-hidden="true" />
        <span className="pbg-drv-status-text">
          {isOnline ? "Je suis dispo" : "En pause"}
        </span>
        <span className="pbg-drv-status-sub">
          {isOnline ? "Touchez pour passer en pause" : "Touchez pour revenir en ligne"}
        </span>
      </button>

      {toast && (
        <div className={`pbg-drv-toast pbg-drv-toast-${toast.kind}`} role="status">{toast.message}</div>
      )}

      {state === "error" && (
        <div className="pbg-drv-section">
          <p className="pbg-drv-empty">Impossible de charger les courses. <button type="button" className="pbg-drv-link" onClick={load}>Réessayer</button></p>
        </div>
      )}

      {/* ═══ MES COURSES EN COURS ═══ */}
      <section className="pbg-drv-section">
        <h2 className="pbg-drv-section-title">
          Mes courses <span className="pbg-drv-count">{orders.length}</span>
        </h2>
        {orders.length === 0 && (
          <p className="pbg-drv-empty">Aucune course en cours. Prenez une course dispo ci-dessous.</p>
        )}
        {orders.map((order) => (
          <MyOrderCard
            key={order.id}
            order={order}
            busy={busyId === order.id}
            onStart={() => handleStart(order)}
            onDeliver={() => setDeliverDialog({ order })}
            onCancel={() => setCancelDialog({ order, reason: "customer_unreachable", custom: "" })}
            onRelease={() => handleRelease(order)}
          />
        ))}
      </section>

      {/* ═══ POOL DES COURSES DISPO ═══ */}
      <section className="pbg-drv-section">
        <div className="pbg-drv-section-head">
          <h2 className="pbg-drv-section-title">
            Courses disponibles <span className="pbg-drv-count">{pool.length}</span>
          </h2>
          <button type="button" className="pbg-drv-icon-btn pbg-drv-icon-btn-sm" onClick={load} aria-label="Rafraîchir">
            <RefreshCw size={15} strokeWidth={1.8} />
          </button>
        </div>
        {state === "loading" && <p className="pbg-drv-empty">Chargement…</p>}
        {state === "ready" && pool.length === 0 && (
          <p className="pbg-drv-empty">Pas de course dispo pour le moment. Les nouvelles apparaîtront ici automatiquement.</p>
        )}
        {pool.map((order) => (
          <PoolOrderCard
            key={order.id}
            order={order}
            busy={busyId === order.id}
            onTake={() => handleTake(order)}
          />
        ))}
      </section>

      {cancelDialog && (
        <CancelDialog
          state={cancelDialog}
          onChange={setCancelDialog}
          onSubmit={submitCancel}
          onClose={() => setCancelDialog(null)}
          busy={Boolean(busyId)}
        />
      )}

      {deliverDialog && (
        <DeliverDialog
          order={deliverDialog.order}
          onConfirm={confirmDeliver}
          onClose={() => setDeliverDialog(null)}
          busy={Boolean(busyId)}
        />
      )}
    </>
  );
}

function DeliverDialog({ order, onConfirm, onClose, busy }) {
  return (
    <div className="pbg-drv-dialog-back" onClick={onClose}>
      <div className="pbg-drv-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Livrée et encaissée</h3>
        <p className="pbg-drv-dialog-note">
          Confirmez que vous avez remis la commande à <strong>{order.firstName} {order.lastName}</strong> et
          reçu le paiement.
        </p>
        <div className="pbg-drv-cash-big">
          <span>Montant encaissé</span>
          <strong>{formatDzd(order.totalCents)}</strong>
        </div>
        <div className="pbg-drv-dialog-actions">
          <button type="button" className="pbg-drv-btn pbg-drv-btn-ghost" onClick={onClose}>Retour</button>
          <button type="button" className="pbg-drv-btn pbg-drv-btn-success" onClick={onConfirm} disabled={busy}>
            <CheckCircle2 size={17} strokeWidth={2} />
            <span>Confirmer</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PoolOrderCard({ order, busy, onTake }) {
  const receivedAt = new Date(order.createdAt);
  const minutesAgo = Math.max(0, Math.round((Date.now() - receivedAt.getTime()) / 60000));
  return (
    <article className="pbg-drv-card pbg-drv-card-pool">
      <header className="pbg-drv-card-head">
        <span className="pbg-drv-order-num">#{order.orderNumber.split("-").pop()}</span>
        <span className="pbg-drv-ago">il y a {minutesAgo}m</span>
      </header>
      <p className="pbg-drv-customer">{order.firstName} {order.lastName}</p>
      <p className="pbg-drv-address">
        <MapPin size={13} strokeWidth={2} />
        <span>{order.deliveryAddress}, {order.communeName}</span>
      </p>
      <ItemsList items={order.items} />
      <div className="pbg-drv-card-meta">
        <span className={`pbg-drv-kitchen-status is-${order.status}`}>
          <Package size={11} strokeWidth={2} /> {STATUS_LABEL[order.status] || order.status}
        </span>
        <span className="pbg-drv-total">{formatDzd(order.totalCents)}</span>
      </div>
      <button
        type="button"
        className="pbg-drv-btn pbg-drv-btn-primary"
        onClick={onTake}
        disabled={busy}
      >
        <Bike size={17} strokeWidth={2} />
        <span>{busy ? "Prise en cours…" : "Prendre cette course"}</span>
      </button>
    </article>
  );
}

function MyOrderCard({ order, busy, onStart, onDeliver, onCancel, onRelease }) {
  const isReady = order.status === "ready";
  const inTransit = Boolean(order.driverStartedAt);

  return (
    <article className="pbg-drv-card pbg-drv-card-mine">
      <header className="pbg-drv-card-head">
        <span className="pbg-drv-order-num">#{order.orderNumber.split("-").pop()}</span>
        <span className={`pbg-drv-kitchen-status is-${order.status}`}>
          {STATUS_LABEL[order.status] || order.status}
        </span>
      </header>
      <p className="pbg-drv-customer">{order.firstName} {order.lastName}</p>
      <div className="pbg-drv-card-links">
        <a href={orderMapsHref(order)} target="_blank" rel="noopener noreferrer" className="pbg-drv-link-chip">
          <MapPin size={13} strokeWidth={2} />
          <span>{order.deliveryAddress}, {order.communeName}</span>
          <ArrowUpRight size={11} strokeWidth={2} />
        </a>
        <a href={`tel:${order.phone}`} className="pbg-drv-link-chip">
          <Phone size={13} strokeWidth={2} />
          <span>{order.phone}</span>
        </a>
      </div>
      <ItemsList items={order.items} />
      <p className="pbg-drv-cash">À encaisser : <strong>{formatDzd(order.totalCents)}</strong></p>

      {/* Actions contextuelles */}
      {!isReady && !inTransit && (
        <p className="pbg-drv-waiting">⏳ En attente de la cuisine…</p>
      )}
      {isReady && !inTransit && (
        <button type="button" className="pbg-drv-btn pbg-drv-btn-primary" onClick={onStart} disabled={busy}>
          <Bike size={17} strokeWidth={2} />
          <span>Je pars livrer</span>
        </button>
      )}
      {inTransit && (
        <button type="button" className="pbg-drv-btn pbg-drv-btn-success" onClick={onDeliver} disabled={busy}>
          <CheckCircle2 size={17} strokeWidth={2} />
          <span>Livrée et encaissée</span>
        </button>
      )}

      <div className="pbg-drv-card-secondary">
        <button type="button" className="pbg-drv-link" onClick={onCancel} disabled={busy}>
          <X size={12} strokeWidth={2} /> Annuler la course
        </button>
        {!inTransit && (
          <button type="button" className="pbg-drv-link" onClick={onRelease} disabled={busy}>
            <Undo2 size={12} strokeWidth={2} /> Relâcher au pool
          </button>
        )}
      </div>
    </article>
  );
}

function ItemsList({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="pbg-drv-items">
      {items.map((item, i) => (
        <li key={i}>
          <span className="pbg-drv-qty">{item.quantity}×</span>
          <span>{item.title}</span>
        </li>
      ))}
    </ul>
  );
}

function CancelDialog({ state, onChange, onSubmit, onClose, busy }) {
  return (
    <div className="pbg-drv-dialog-back" onClick={onClose}>
      <form className="pbg-drv-dialog" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h3>Annuler la course</h3>
        <p className="pbg-drv-dialog-note">Choisissez le motif — il sera visible dans le back-office.</p>
        <div className="pbg-drv-radios">
          {CANCEL_REASONS.map((r) => (
            <label key={r.value} className={`pbg-drv-radio ${state.reason === r.value ? "is-selected" : ""}`}>
              <input
                type="radio"
                name="cancel-reason"
                value={r.value}
                checked={state.reason === r.value}
                onChange={() => onChange({ ...state, reason: r.value })}
              />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
        {state.reason === "other" && (
          <input
            type="text"
            className="pbg-drv-dialog-input"
            placeholder="Précisez…"
            value={state.custom}
            onChange={(e) => onChange({ ...state, custom: e.target.value })}
            maxLength={150}
            required
          />
        )}
        <div className="pbg-drv-dialog-actions">
          <button type="button" className="pbg-drv-btn pbg-drv-btn-ghost" onClick={onClose}>Retour</button>
          <button type="submit" className="pbg-drv-btn pbg-drv-btn-danger" disabled={busy}>
            Confirmer l'annulation
          </button>
        </div>
      </form>
    </div>
  );
}
