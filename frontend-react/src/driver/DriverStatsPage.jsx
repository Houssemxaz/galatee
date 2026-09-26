import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, CheckCircle2, XCircle } from "lucide-react";
import { fetchDriverOrders } from "./api";

const STATUS_LABELS = {
  delivered: "Livrée",
  cancelled: "Annulée",
  completed: "Terminée",
  withdrawn: "Retirée",
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function DriverStatsPage({ driver }) {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    fetchDriverOrders()
      .then((payload) => {
        setStats(payload.stats || null);
        setHistory(payload.history || []);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <>
      <header className="pbg-drv-header">
        <Link to="/livreur" className="pbg-drv-icon-btn" aria-label="Retour">
          <ChevronLeft size={18} strokeWidth={1.8} />
        </Link>
        <div>
          <p className="pbg-drv-hello">Statistiques</p>
          <p className="pbg-drv-firstname">{driver.firstName}</p>
        </div>
        <div />
      </header>

      {state === "loading" && <p className="pbg-drv-empty">Chargement…</p>}
      {state === "error" && <p className="pbg-drv-empty">Impossible de charger vos stats.</p>}

      {state === "ready" && stats && (
        <>
          <section className="pbg-drv-section">
            <StatBlock label="Aujourd'hui" period={stats.today} />
            <StatBlock label="Cette semaine" period={stats.week} />
            <StatBlock label="Ce mois" period={stats.month} />
            <StatBlock label="Total à vie" period={stats.lifetime} highlight />
          </section>

          <section className="pbg-drv-section">
            <h2 className="pbg-drv-section-title">Historique récent</h2>
            {history.length === 0 && (
              <p className="pbg-drv-empty">Vos courses livrées s'afficheront ici.</p>
            )}
            {history.map((order) => (
              <article key={order.id} className="pbg-drv-history-row">
                <div className="pbg-drv-history-icon">
                  {order.status === "cancelled" ? (
                    <XCircle size={16} strokeWidth={2} />
                  ) : (
                    <CheckCircle2 size={16} strokeWidth={2} />
                  )}
                </div>
                <div className="pbg-drv-history-body">
                  <p className="pbg-drv-history-main">
                    #{order.orderNumber.split("-").pop()} · {order.firstName} {order.lastName || ""}
                  </p>
                  <p className="pbg-drv-history-meta">
                    {formatDate(order.deliveredAt || order.driverAssignedAt)} · {formatTime(order.deliveredAt || order.driverAssignedAt)}
                    {" · "}{order.communeName || "—"}
                  </p>
                </div>
                <span className={`pbg-drv-history-status is-${order.status}`}>
                  {STATUS_LABELS[order.status] || order.status}
                </span>
              </article>
            ))}
          </section>
        </>
      )}
    </>
  );
}

function StatBlock({ label, period, highlight }) {
  const delivered = period?.delivered ?? 0;
  const cancelled = period?.cancelled ?? 0;
  return (
    <div className={`pbg-drv-stat ${highlight ? "is-highlight" : ""}`}>
      <p className="pbg-drv-stat-label">{label}</p>
      <div className="pbg-drv-stat-row">
        <div>
          <span className="pbg-drv-stat-count">{delivered}</span>
          <span className="pbg-drv-stat-sub">livrées</span>
        </div>
        <div>
          <span className="pbg-drv-stat-count pbg-drv-stat-cancel">{cancelled}</span>
          <span className="pbg-drv-stat-sub">annulées</span>
        </div>
      </div>
    </div>
  );
}
