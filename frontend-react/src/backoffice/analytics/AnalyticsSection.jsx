import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BarChart3, Clock3, Database, LineChart, RefreshCw, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, apiMessage } from "../api";
import DateRangeFilter, { defaultRange } from "../shared/DateRangeFilter.jsx";
import FunnelSummary from "./FunnelSummary.jsx";
// Recharts (~200 kB minifie) est isole dans son propre chunk : il ne charge
// qu au premier rendu des graphes, pas au premier clic sur "Statistiques".
const AnalyticsChart = lazy(() => import("./AnalyticsChart.jsx"));
const OrdersChart = lazy(() => import("./OrdersChart.jsx"));
const RevenueChart = lazy(() => import("./StatsRevenueChart.jsx"));
const FunnelChart = lazy(() => import("./FunnelChart.jsx"));
const ProductPerformance = lazy(() => import("./ProductPerformance.jsx"));
const BusiestSlots = lazy(() => import("./BusiestSlots.jsx"));

function ChartFallback() {
  return <div className="bo-chart-loading" aria-hidden="true" style={{ minHeight: 240 }} />;
}

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
          <div className={`bo-stats-database-status ${dashboard.database === "postgres" ? "is-postgres" : "is-local"}`} role="status">
            <Database size={14} strokeWidth={1.8} />
            <span>Données chargées depuis <strong>{dashboard.database === "postgres" ? "PostgreSQL" : "SQLite local"}</strong>.</span>
            {dashboard.database !== "postgres" && <small>La production doit démarrer avec `GALATEE_DATABASE=postgres`.</small>}
          </div>

          <section className="bo-stats-section">
            <div className="bo-stats-section-head">
              <div>
                <p className="bo-eyebrow">Aperçu chiffré</p>
                <h3>Métriques clés</h3>
              </div>
            </div>
            <FunnelSummary totals={dashboard.totals} previousTotals={dashboard.previousPeriod?.totals} series={dashboard.series} />
          </section>

          <section className="bo-stats-section bo-stats-section-traffic">
            <div className="bo-stats-section-head">
              <div>
                <p className="bo-eyebrow">Visibilité</p>
                <h3>Le site attire-t-il des visiteurs ?</h3>
                <p className="bo-stats-section-sub">Suis les visites du site, les visiteurs uniques et l’intérêt pour le menu.</p>
              </div>
              <span className="bo-stats-section-badge"><LineChart size={12} /> {groupBy === "day" ? "Jour" : groupBy === "week" ? "Semaine" : groupBy === "month" ? "Mois" : "Année"}</span>
            </div>
            <Suspense fallback={<ChartFallback />}>
              <AnalyticsChart series={dashboard.series} />
            </Suspense>
          </section>

          <section className="bo-stats-section bo-stats-section-sales">
            <div className="bo-stats-section-head">
              <div>
                <p className="bo-eyebrow">Ventes</p>
                <h3>Les commandes génèrent-elles du chiffre d’affaires ?</h3>
                <p className="bo-stats-section-sub">Les volumes de commandes et le CA confirmé sont séparés pour éviter toute confusion d’échelle.</p>
              </div>
              <span className="bo-stats-section-badge"><BarChart3 size={12} /> Résultats</span>
            </div>
            <div className="bo-stats-dual-grid">
              <Suspense fallback={<ChartFallback />}><OrdersChart series={dashboard.series} /></Suspense>
              <Suspense fallback={<ChartFallback />}><RevenueChart series={dashboard.series} /></Suspense>
            </div>
          </section>

          <section className="bo-stats-section bo-stats-section-funnel">
            <div className="bo-stats-section-head">
              <div>
                <p className="bo-eyebrow">Parcours client</p>
                <h3>À quel moment perd-on une commande ?</h3>
                <p className="bo-stats-section-sub">Le parcours part de la visite et termine sur une commande confirmée.</p>
              </div>
              <span className="bo-stats-section-badge"><Route size={12} /> Conversion</span>
            </div>
            <Suspense fallback={<ChartFallback />}><FunnelChart totals={dashboard.totals} /></Suspense>
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
            <Suspense fallback={<ChartFallback />}>
              <ProductPerformance products={dashboard.products} />
            </Suspense>
          </section>

          <section className="bo-stats-section bo-stats-section-organisation">
            <div className="bo-stats-section-head">
              <div>
                <p className="bo-eyebrow">Organisation</p>
                <h3>Quand les commandes arrivent</h3>
                <p className="bo-stats-section-sub">Les créneaux les plus chargés sur les commandes non annulées.</p>
              </div>
              <span className="bo-stats-section-badge"><Clock3 size={12} /> Horaires</span>
            </div>
            <Suspense fallback={<ChartFallback />}>
              <BusiestSlots slots={dashboard.busiestSlots || []} />
            </Suspense>
          </section>
        </>
      )}
    </div>
  );
}
