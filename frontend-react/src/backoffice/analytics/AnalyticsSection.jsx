import { useCallback, useEffect, useState } from "react";
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
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger les statistiques du site.") });
    }
  }, [range, groupBy]);

  useEffect(() => {
    load();
  }, [load, token]);

  return (
    <div className="bo-panel">
      <div className="bo-panel-heading">
        <div>
          <p className="bo-eyebrow">Pilotage du site</p>
          <h2>Statistiques utiles</h2>
        </div>
      </div>

      {alert && <p className="bo-alert" data-kind={alert.kind} role="status">{alert.message}</p>}

      <DateRangeFilter range={range} onRangeChange={setRange} groupBy={groupBy} onGroupByChange={setGroupBy} />

      {state === "loading" && <p className="bo-empty">Chargement...</p>}
      {state === "ready" && dashboard && (
        <>
          <FunnelSummary totals={dashboard.totals} />
          <AnalyticsChart series={dashboard.series} />
          <ProductPerformance products={dashboard.products} />
        </>
      )}
    </div>
  );
}
