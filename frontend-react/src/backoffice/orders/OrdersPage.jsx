import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Bike, Check, ChevronDown, ChevronRight, Inbox, MapPin, Phone, RefreshCw, ShoppingBag, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiMessage, apiRequest } from "../api";
import { Slideover, EmptyState, SkeletonRows } from "../shared/primitives.jsx";

const STATUS_META = {
  pending: ["En attente", "warn"],
  confirmed: ["Confirmée", "info"],
  ready: ["Prête", "ok"],
  delivered: ["Livrée", "muted"],
  cancelled: ["Annulée", "muted"],
};

function formatDzd(cents) { return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`; }
function formatDate(value) { return value ? new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"; }
function Status({ value }) { const [label, tone] = STATUS_META[value] || [value, "muted"]; return <span className={`bo-status bo-status-${tone}`}>{label}</span>; }

function nextAction(order) {
  if (order.status === "pending") return ["confirmed", "Confirmer"];
  if (order.status === "confirmed") return ["ready", "Marquer prête"];
  // En livraison, le livreur marque livree via la PWA — le staff n a rien a faire.
  if (order.status === "ready" && order.deliveryMode === "pickup") return ["delivered", "Marquer retirée"];
  return null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [state, setState] = useState("idle");
  const [alert, setAlert] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [notificationMessage, setNotificationMessage] = useState("");
  const knownPendingRef = useRef(null);

  function notifyNewOrders(count) {
    if (!count) return;
    const message = `${count} nouvelle${count > 1 ? "s" : ""} commande${count > 1 ? "s" : ""} à traiter.`;
    setNotificationMessage(message);
    if (notificationPermission === "granted" && typeof Notification !== "undefined") {
      try { new Notification("Galatée · nouvelle commande", { body: message }); } catch { /* Notification can be blocked after permission changes. */ }
    }
    window.setTimeout(() => setNotificationMessage(""), 7000);
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  const load = useCallback(async () => {
    setState("loading");
    try {
      // On charge toutes les commandes puis on filtre cote client — permet
      // aux compteurs KPI de rester exacts quel que soit le filtre actif.
      const orderPayload = await apiRequest(`/admin/orders`);
      const nextOrders = orderPayload.orders || [];
      const nextPending = new Set(nextOrders.filter((order) => order.status === "pending").map((order) => order.id));
      if (knownPendingRef.current) {
        const added = [...nextPending].filter((id) => !knownPendingRef.current.has(id)).length;
        notifyNewOrders(added);
      }
      knownPendingRef.current = nextPending;
      setOrders(nextOrders);
      setState("ready");
      setAlert(null);
    } catch (error) { setState("error"); setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger les commandes.") }); }
  }, [notificationPermission]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15_000); return () => clearInterval(id); }, [load]);

  // Charge la liste des livreurs actifs pour la dropdown d assignation.
  const loadDrivers = useCallback(async () => {
    try {
      const payload = await apiRequest("/admin/drivers");
      setDrivers(payload.drivers || []);
    } catch { /* silencieux : la page ordres reste utilisable sans livreurs */ }
  }, []);
  useEffect(() => { loadDrivers(); }, [loadDrivers]);

  async function assignDriver(order, driverId) {
    setActionId(`${order.id}:assign`);
    try {
      await apiRequest(`/admin/orders/${encodeURIComponent(order.id)}/assign-driver`, {
        method: "PATCH",
        body: JSON.stringify({ driverId }),
      });
      await Promise.all([load(), loadDrivers()]);
      const updated = orders.find((o) => o.id === order.id);
      if (updated) {
        const refreshed = (await apiRequest(`/admin/orders`)).orders.find((o) => o.id === order.id);
        if (refreshed) setExpanded(refreshed);
      }
      const driver = drivers.find((d) => d.id === driverId);
      setAlert({ kind: "success", message: driver ? `${driver.firstName} assigné à la commande.` : "Livreur assigné." });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Assignation impossible.") });
    } finally {
      setActionId(null);
    }
  }

  async function unassignDriver(order) {
    setActionId(`${order.id}:unassign`);
    try {
      await apiRequest(`/admin/orders/${encodeURIComponent(order.id)}/assign-driver`, {
        method: "PATCH",
        body: JSON.stringify({ driverId: null }),
      });
      await Promise.all([load(), loadDrivers()]);
      const refreshed = (await apiRequest(`/admin/orders`)).orders.find((o) => o.id === order.id);
      if (refreshed) setExpanded(refreshed);
      setAlert({ kind: "success", message: "Livreur retiré." });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Désassignation impossible.") });
    } finally {
      setActionId(null);
    }
  }

  const filtered = useMemo(() => {
    const byStatus = statusFilter === "all"
      ? orders
      : statusFilter === "active"
        ? orders.filter((o) => ["pending", "confirmed", "ready"].includes(o.status))
        : orders.filter((o) => o.status === statusFilter);
    if (!search) return byStatus;
    const term = search.toLowerCase();
    return byStatus.filter((order) =>
      `${order.orderNumber} ${order.firstName} ${order.lastName} ${order.phone} ${order.communeName}`.toLowerCase().includes(term)
    );
  }, [orders, statusFilter, search]);

  const counts = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    active: orders.filter((o) => ["pending", "confirmed", "ready"].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  }), [orders]);

  const cashedInAmount = useMemo(() =>
    orders.filter((o) => o.status === "delivered").reduce((sum, o) => sum + (o.totalCents || 0), 0),
    [orders]
  );

  async function updateStatus(order, status) {
    setActionId(`${order.id}:${status}`);
    try {
      const payload = await apiRequest(`/admin/orders/${encodeURIComponent(order.id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setOrders((current) => current.map((item) => item.id === order.id ? payload.order : item));
      setExpanded(payload.order);
      setAlert({ kind: "success", message: `Commande ${payload.order.orderNumber} mise à jour.` });
    } catch (error) { setAlert({ kind: "error", message: apiMessage(error, "Le changement de statut a échoué.") }); }
    finally { setActionId(null); }
  }

  return <div className="bo-page">
    {notificationMessage && <p className="bo-order-notification" role="status"><Bell size={15} /> {notificationMessage}</p>}

    <section className="bo-kpis" aria-label="Indicateurs commandes">
      <button
        type="button"
        className={`bo-kpi bo-kpi-clickable ${statusFilter === "all" ? "is-active" : ""}`}
        onClick={() => setStatusFilter("all")}
      >
        <p className="bo-kpi-label">Total</p>
        <p className="bo-kpi-value">{counts.total}</p>
        <p className="bo-kpi-hint">Toutes commandes</p>
      </button>
      <button
        type="button"
        className={`bo-kpi bo-kpi-clickable bo-kpi-warn ${statusFilter === "active" ? "is-active" : ""}`}
        onClick={() => setStatusFilter("active")}
      >
        <p className="bo-kpi-label">En cours</p>
        <p className="bo-kpi-value">{counts.active}</p>
        <p className="bo-kpi-hint">{counts.pending} à confirmer</p>
      </button>
      <button
        type="button"
        className={`bo-kpi bo-kpi-clickable bo-kpi-ok ${statusFilter === "delivered" ? "is-active" : ""}`}
        onClick={() => setStatusFilter("delivered")}
      >
        <p className="bo-kpi-label">Encaissées</p>
        <p className="bo-kpi-value">{counts.delivered}</p>
        <p className="bo-kpi-hint">{formatDzd(cashedInAmount)}</p>
      </button>
      <button
        type="button"
        className={`bo-kpi bo-kpi-clickable bo-kpi-danger ${statusFilter === "cancelled" ? "is-active" : ""}`}
        onClick={() => setStatusFilter("cancelled")}
      >
        <p className="bo-kpi-label">Annulées</p>
        <p className="bo-kpi-value">{counts.cancelled}</p>
        <p className="bo-kpi-hint">Sur toute la période</p>
      </button>
    </section>

    <section className="bo-status-chips" aria-label="Filtre par statut">
      {[
        ["all", `Toutes (${counts.total})`],
        ["pending", `En attente (${counts.pending})`],
        ["confirmed", `Confirmées (${orders.filter((o) => o.status === "confirmed").length})`],
        ["ready", `Prêtes (${orders.filter((o) => o.status === "ready").length})`],
        ["delivered", `Livrées (${counts.delivered})`],
        ["cancelled", `Annulées (${counts.cancelled})`],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={`bo-status-chip ${statusFilter === value ? "is-active" : ""}`}
          onClick={() => setStatusFilter(value)}
        >
          {label}
        </button>
      ))}
    </section>

    <section className="bo-filters" aria-label="Recherche">
      <div className="bo-filter-group bo-filter-search">
        <label className="bo-filter-label">Recherche</label>
        <Input placeholder="N° commande, client, téléphone…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <Button variant="outline" size="sm" onClick={load} aria-label="Rafraîchir les commandes"><RefreshCw size={14} /></Button>
      {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
        <Button variant="outline" size="sm" onClick={enableNotifications} title="Activer les notifications de nouvelles commandes">
          <Bell size={14} /> <span>Activer les alertes</span>
        </Button>
      )}
    </section>
    {alert && <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>}
    <section className="bo-table-wrap">
      <div className="bo-table-heading">
        <div>
          <p className="bo-eyebrow">Suivi opérationnel</p>
          <h2 className="bo-table-title">Commandes</h2>
        </div>
        <span className="bo-live-note"><span className="bo-live-dot" /> Mise à jour toutes les 15 s</span>
      </div>

      {state === "loading" && (
        <table className="bo-table">
          <thead>
            <tr>
              <th>N°</th><th>Client</th><th>Mode</th><th>Total</th><th>Statut</th><th />
            </tr>
          </thead>
          <tbody>
            <SkeletonRows rows={6} cols={6} />
          </tbody>
        </table>
      )}

      {state === "error" && (
        <EmptyState
          icon={Inbox}
          title="Impossible de charger les commandes"
          description="Vérifiez la connexion au serveur puis réessayez."
          actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw size={13} /> Réessayer</Button>}
        />
      )}

      {state === "ready" && !filtered.length && (
        <EmptyState
          icon={Inbox}
          title="Aucune commande"
          description={search || statusFilter !== "all" ? "Aucune commande ne correspond aux filtres actuels." : "Les nouvelles commandes s'afficheront ici en temps réel."}
        />
      )}

      {state === "ready" && filtered.length > 0 && (
        <table className="bo-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Client</th>
              <th>Mode</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th>Statut</th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr
                className="bo-tr"
                key={order.id}
                onClick={() => setExpanded(order)}
              >
                <td className="bo-td-num">{order.orderNumber}</td>
                <td>
                  <span className="bo-td-name-line" style={{ fontWeight: 600 }}>{order.firstName} {order.lastName}</span>
                  <span className="bo-td-contact-sub"><Phone size={10} strokeWidth={2} /> {order.phone}</span>
                </td>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ShoppingBag size={12} strokeWidth={1.8} />
                    {order.deliveryMode === "delivery" ? `Livraison · ${order.communeName}` : "Retrait"}
                  </span>
                </td>
                <td className="bo-td-num" style={{ textAlign: "right", fontWeight: 600 }}>{formatDzd(order.totalCents)}</td>
                <td><Status value={order.status} /></td>
                <td style={{ textAlign: "right", color: "var(--bo-ink-muted)" }}>
                  <ChevronRight size={14} strokeWidth={2} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>

    {/* ═══ Slide-over détail commande ═══ */}
    <Slideover
      open={Boolean(expanded)}
      onClose={() => setExpanded(null)}
      eyebrow={expanded ? `Commande ${expanded.orderNumber}` : ""}
      title={expanded ? `${expanded.firstName} ${expanded.lastName}` : ""}
      footer={expanded ? (() => {
        const action = nextAction(expanded);
        return (
          <>
            {["pending", "confirmed"].includes(expanded.status) && (
              <Button variant="outline" onClick={() => updateStatus(expanded, "cancelled")} disabled={actionId === `${expanded.id}:cancelled`}>
                <X size={14} /> Annuler
              </Button>
            )}
            {expanded.status === "pending" && (
              <Button className="bo-action-confirm" onClick={() => updateStatus(expanded, "confirmed")} disabled={actionId === `${expanded.id}:confirmed`}>
                <Check size={14} /> Confirmer après appel
              </Button>
            )}
            {action && expanded.status !== "pending" && (
              <Button onClick={() => updateStatus(expanded, action[0])} disabled={actionId === `${expanded.id}:${action[0]}`}>
                <Check size={14} /> {action[1]}
              </Button>
            )}
          </>
        );
      })() : null}
    >
      {expanded && (
        <div className="bo-order-sheet">
          <div className="bo-order-sheet-status">
            <Status value={expanded.status} />
            <span className="bo-order-sheet-total">{formatDzd(expanded.totalCents)}</span>
          </div>

          <div className="bo-order-sheet-block">
            <p className="bo-order-sheet-label">Contact</p>
            <p><Phone size={11} strokeWidth={2} /> {expanded.phone}</p>
          </div>

          <div className="bo-order-sheet-block">
            <p className="bo-order-sheet-label">Réception</p>
            <p>
              <MapPin size={11} strokeWidth={2} />{" "}
              {expanded.deliveryMode === "delivery"
                ? `${expanded.deliveryAddress}, ${expanded.communeName}`
                : "Retrait chez Galatée"}
            </p>
            <p style={{ color: "var(--bo-ink-muted)", fontSize: 12 }}>
              Paiement à la {expanded.deliveryMode === "delivery" ? "livraison" : "récupération"}
            </p>
          </div>

          {expanded.deliveryMode === "delivery" && ["confirmed", "ready"].includes(expanded.status) && (
            <div className="bo-order-sheet-block">
              <p className="bo-order-sheet-label"><Bike size={11} strokeWidth={2} /> Livreur</p>
              {expanded.assignedDriverId ? (
                (() => {
                  const driver = drivers.find((d) => d.id === expanded.assignedDriverId);
                  return (
                    <div className="bo-driver-assigned">
                      <p>
                        <strong>{driver ? `${driver.firstName} ${driver.lastName || ""}` : "Livreur inconnu"}</strong>
                        {driver?.phone && <span style={{ color: "var(--bo-ink-muted)", marginLeft: 8 }}>{driver.phone}</span>}
                      </p>
                      <button
                        type="button"
                        className="bo-link-btn"
                        onClick={() => unassignDriver(expanded)}
                        disabled={actionId === `${expanded.id}:unassign`}
                      >
                        <UserX size={12} /> Retirer l'assignation
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div className="bo-driver-assign-row">
                  <select
                    className="bo-native-select"
                    value=""
                    onChange={(e) => e.target.value && assignDriver(expanded, e.target.value)}
                    disabled={actionId === `${expanded.id}:assign`}
                  >
                    <option value="">Choisir un livreur…</option>
                    {drivers.filter((d) => d.active).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.firstName} {d.lastName} · {d.currentStatus === "available" ? "dispo" : d.currentStatus === "busy" ? "en course" : "offline"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {drivers.length === 0 && (
                <p style={{ color: "var(--bo-ink-muted)", fontSize: 12, margin: "8px 0 0" }}>
                  Ajoutez d'abord un livreur dans l'onglet Livreurs.
                </p>
              )}
            </div>
          )}

          <div className="bo-order-sheet-block">
            <p className="bo-order-sheet-label">Articles</p>
            <ul className="bo-order-sheet-items">
              {expanded.items.map((item) => (
                <li key={`${expanded.id}-${item.productId}`}>
                  <span>{item.quantity} × {item.title}</span>
                  <strong>{formatDzd(item.lineTotalCents)}</strong>
                </li>
              ))}
            </ul>
          </div>

          <p className="bo-order-sheet-note">Reçue le {formatDate(expanded.createdAt)}</p>
        </div>
      )}
    </Slideover>
  </div>;
}
