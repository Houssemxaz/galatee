import { useCallback, useEffect, useState } from "react";
import { apiRequest, apiMessage } from "../api";
import DateRangeFilter, { defaultRange } from "../shared/DateRangeFilter.jsx";
import RevenueSummaryCards from "./RevenueSummaryCards.jsx";
import RevenueChart from "./RevenueChart.jsx";
import RevenueEntryForm from "./RevenueEntryForm.jsx";
import RevenueEntriesTable from "./RevenueEntriesTable.jsx";

export default function RevenueSection({ token }) {
  const [range, setRange] = useState(defaultRange());
  const [groupBy, setGroupBy] = useState("day");
  const [dashboard, setDashboard] = useState(null);
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState("idle");
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to, groupBy });
      const [dashboardPayload, entriesPayload] = await Promise.all([
        apiRequest(`/admin/revenue?${params}`),
        apiRequest(`/admin/revenue?${new URLSearchParams({ from: range.from, to: range.to, entries: "true" })}`),
      ]);
      setDashboard(dashboardPayload);
      setEntries(entriesPayload.entries);
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger les revenus.") });
    }
  }, [range, groupBy]);

  useEffect(() => {
    load();
  }, [load, token]);

  function handleEntrySaved() {
    setAlert({ kind: "success", message: "Revenu enregistré." });
    load();
  }

  function handleEntryChanged() {
    load();
  }

  return (
    <div className="bo-panel">
      <div className="bo-panel-heading">
        <div>
          <p className="bo-eyebrow">Chiffre d'affaires</p>
          <h2>Revenus</h2>
        </div>
      </div>

      {alert && <p className="bo-alert" data-kind={alert.kind} role="status">{alert.message}</p>}

      <RevenueEntryForm onSaved={handleEntrySaved} />
      <DateRangeFilter range={range} onRangeChange={setRange} groupBy={groupBy} onGroupByChange={setGroupBy} />

      {state === "loading" && <p className="bo-empty">Chargement...</p>}
      {state === "ready" && dashboard && (
        <>
          <RevenueSummaryCards dashboard={dashboard} />
          <RevenueChart series={dashboard.series} />
          <RevenueEntriesTable entries={entries} onChanged={handleEntryChanged} />
        </>
      )}
    </div>
  );
}
