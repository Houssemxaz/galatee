import { useCallback, useEffect, useState } from "react";
import { LineChart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, apiMessage } from "../api";
import DateRangeFilter, { defaultRange } from "../shared/DateRangeFilter.jsx";
import FunnelSummary from "./FunnelSummary.jsx";
import AnalyticsChart from "./AnalyticsChart.jsx";
import ProductPerformance from "./ProductPerformance.jsx";

export default function AnalyticsSection({ token }) {
  const [range, setRange] = useState(defaultRange());
  const [groupBy, setGroupBy] = useState("day");
  const [dashboard, setDashboard] = useState(null);
  const [state, setState] = useState("idle");
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to, groupBy });
      const payload = await apiRequest(`/admin/site-stats?${params}`);
      setDashboard(payload);
      setState("ready");
      setAlert(null);
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger les statistiques du site.") });
    }
  }, [range, groupBy]);

  useEffect(() => { load(); }, [load, token]);

  return (
    <div className="bo-page bo-stats-page">
      <header className="bo-stats-header">
        <div>
          <p className="bo-eyebrow">Pilotage du site</p>
          <h2 className="bo-stats-title">Statistiques</h2>
          <p className="bo-stats-sub">Trafic, funnel de commande et performance produit.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} aria-label="Rafraîchir">
          <RefreshCw size={13} strokeWidth={1.8} /> Rafraîchir
        </Button>
      </header>

      <section className="bo-stats-filterbar">
        <DateRangeFilter
          range={range}
          onRangeChange={setRange}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />
      </section>

      {alert && <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>}

      {state === "loading" && (
        <div className="bo-stats-skeleton">
          <div className="bo-stats-skeleton-grid">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bo-stats-skeleton-card" />
            ))}
          </div>
        </div>
      )}

      {state === "error" && (
        <p className="bo-empty">Impossible de charger les statistiques. Vérifiez votre connexion.</p>
      )}

      {state === "ready" && dashboard && (
        <>
          <section className="bo-stats-section">
            <div className="bo-stats-section-head">
              <div>
                <p className="bo-eyebrow">Aperçu chiffré</p>
                <h3>Métriques clés</h3>
              </div>
            </div>
            <FunnelSummary totals={dashboard.totals} />
          </section>

          <section className="bo-stats-section">
            <div className="bo-stats-section-head">
              <div>
                <p className="bo-eyebrow">Activité par période</p>
                <h3>Évolution dans le temps</h3>
                <p className="bo-stats-section-sub">
                  Trafic et activité commerciale sur la période sélectionnée.
                </p>
              </div>
              <span className="bo-stats-section-badge"><LineChart size={12} /> {groupBy === "day" ? "Jour" : groupBy === "week" ? "Semaine" : groupBy === "month" ? "Mois" : "Année"}</span>
            </div>
            <AnalyticsChart series={dashboard.series} />
          </section>

          <section className="bo-stats-section">
            <div className="bo-stats-section-head">
              <div>
                <p className="bo-eyebrow">Menu</p>
                <h3>Performance des plats</h3>
                <p className="bo-stats-section-sub">
                  Vues et taux d'ajout au panier par plat pour la période.
                </p>
              </div>
            </div>
            <ProductPerformance products={dashboard.products} />
          </section>
        </>
      )}
    </div>
  );
}
