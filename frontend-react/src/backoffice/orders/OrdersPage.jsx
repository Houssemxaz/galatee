import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, ChevronDown, ChevronRight, Inbox, MapPin, Phone, RefreshCw, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiMessage, apiRequest } from "../api";
import { Slideover, EmptyState, SkeletonRows } from "../shared/primitives.jsx";

const STATUS_META = {
  pending: ["À appeler", "warn"],
  confirmed: ["Confirmée", "ok"],
  cancelled: ["Annulée", "muted"],
  preparing: ["En préparation", "info"],
  ready: ["Prête", "ok"],
  delivered: ["Livrée", "info"],
  withdrawn: ["Retirée", "info"],
  completed: ["Terminée", "muted"],
};

function formatDzd(cents) { return `${new Intl.NumberFormat("fr-DZ").format(Math.round(Number(cents || 0) / 100))} DA`; }
function formatDate(value) { return value ? new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"; }
function Status({ value }) { const [label, tone] = STATUS_META[value] || [value, "muted"]; return <span className={`bo-status bo-status-${tone}`}>{label}</span>; }

function nextAction(order) {
  if (order.status === "pending") return ["confirmed", "Confirmer"];
  if (order.status === "confirmed") return ["preparing", "En préparation"];
  if (order.status === "preparing") return ["ready", "Marquer prête"];
  if (order.status === "ready") return [order.deliveryMode === "delivery" ? "delivered" : "withdrawn", order.deliveryMode === "delivery" ? "Marquer livrée" : "Marquer retirée"];
  if (order.status === "delivered" || order.status === "withdrawn") return ["completed", "Terminer"];
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
      const query = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const orderPayload = await apiRequest(`/admin/orders${query}`);
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
  }, [statusFilter, notificationPermission]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15_000); return () => clearInterval(id); }, [load]);

  const filtered = useMemo(() => orders.filter((order) => !search || `${order.orderNumber} ${order.firstName} ${order.lastName} ${order.phone} ${order.communeName}`.toLowerCase().includes(search.toLowerCase())), [orders, search]);
  const pendingCount = orders.filter((order) => order.status === "pending").length;

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
    <section className="bo-kpis" aria-label="Indicateurs commandes"><div className="bo-kpi bo-kpi-warn"><p className="bo-kpi-label">À traiter</p><p className="bo-kpi-value">{pendingCount}</p><p className="bo-kpi-hint">Appels de confirmation</p></div><div className="bo-kpi"><p className="bo-kpi-label">Commandes affichées</p><p className="bo-kpi-value">{filtered.length}</p><p className="bo-kpi-hint">Actualisation automatique</p></div></section>
    <section className="bo-filters" aria-label="Filtres commandes"><div className="bo-filter-group"><label className="bo-filter-label">Statut</label><select className="bo-native-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Toutes</option>{Object.entries(STATUS_META).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="bo-filter-group bo-filter-search"><label className="bo-filter-label">Recherche</label><Input placeholder="N° commande, client, téléphone…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Button variant="outline" size="sm" onClick={load} aria-label="Rafraîchir les commandes"><RefreshCw size={14} /></Button>{notificationPermission !== "granted" && notificationPermission !== "unsupported" && <Button variant="outline" size="sm" onClick={enableNotifications} title="Activer les notifications de nouvelles commandes"><Bell size={14} /> <span>Activer les alertes</span></Button>}</section>
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
            {["pending", "confirmed", "preparing"].includes(expanded.status) && (
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
