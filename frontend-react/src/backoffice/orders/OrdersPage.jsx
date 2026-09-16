import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, ChevronDown, MapPin, Phone, RefreshCw, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiMessage, apiRequest } from "../api";

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
      try { new Notification("Galatee · nouvelle commande", { body: message }); } catch { /* Notification can be blocked after permission changes. */ }
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
    <section className="bo-table-wrap"><div className="bo-section-heading"><div><p className="bo-eyebrow">Suivi opérationnel</p><h2>Commandes</h2></div><span className="bo-live-note"><span className="bo-live-dot" /> Mise à jour toutes les 15 s</span></div>{state === "loading" && <p className="bo-empty">Chargement des commandes…</p>}{state === "error" && <p className="bo-empty">Impossible de charger les commandes.</p>}{state === "ready" && !filtered.length && <p className="bo-empty">Aucune commande ne correspond aux filtres.</p>}{state === "ready" && filtered.length > 0 && <div className="bo-order-list">{filtered.map((order) => { const action = nextAction(order); return <article className={`bo-order-row ${expanded?.id === order.id ? "is-expanded" : ""}`} key={order.id}><button type="button" className="bo-order-main" onClick={() => setExpanded(expanded?.id === order.id ? null : order)}><span className="bo-order-number">{order.orderNumber}</span><span className="bo-order-client"><strong>{order.firstName} {order.lastName}</strong><small><Phone size={11} /> {order.phone}</small></span><span className="bo-order-mode"><ShoppingBag size={13} /> {order.deliveryMode === "delivery" ? `Livraison · ${order.communeName}` : "Retrait sur place"}</span><span className="bo-order-total">{formatDzd(order.totalCents)}</span><Status value={order.status} /><ChevronDown className="bo-order-chevron" size={16} /></button>{expanded?.id === order.id && <div className="bo-order-detail"><div className="bo-order-items">{order.items.map((item) => <div key={`${order.id}-${item.productId}`}><span>{item.quantity} × {item.title}</span><strong>{formatDzd(item.lineTotalCents)}</strong></div>)}</div><div className="bo-order-info"><span><MapPin size={13} /> {order.deliveryMode === "delivery" ? `${order.deliveryAddress}, ${order.communeName}` : "Retrait chez Galatee"}</span><span>Paiement à la {order.deliveryMode === "delivery" ? "livraison" : "récupération"}</span><small>Reçue le {formatDate(order.createdAt)}</small></div><div className="bo-order-actions">{order.status === "pending" && <Button className="bo-action-confirm" onClick={() => updateStatus(order, "confirmed")} disabled={actionId === `${order.id}:confirmed`}><Check size={14} /> Confirmer après appel</Button>}{action && order.status !== "pending" && <Button onClick={() => updateStatus(order, action[0])} disabled={actionId === `${order.id}:${action[0]}`}><Check size={14} /> {action[1]}</Button>}{["pending", "confirmed", "preparing"].includes(order.status) && <Button variant="outline" onClick={() => updateStatus(order, "cancelled")} disabled={actionId === `${order.id}:cancelled`}><X size={14} /> Annuler</Button>}</div></div>}</article>; })}</div>}</section>
  </div>;
}
