const STEPS = [
  ["pageViewed", "Visites site"],
  ["menuViewed", "Visites menu"],
  ["orderStarted", "Commandes commencées"],
  ["orderSubmitted", "Commandes envoyées"],
  ["confirmed", "Commandes confirmées"],
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString("fr-FR");
}

export default function FunnelChart({ totals }) {
  const events = totals?.events || {};
  const orders = totals?.orders || {};
  const values = STEPS.map(([key, label]) => ({
    key,
    label,
    value: key === "confirmed" ? orders.confirmed || 0 : events[key] || 0,
  }));
  const base = values[0]?.value || 0;

  return (
    <div className="bo-chart-wrap bo-funnel-panel">
      <div className="bo-chart-heading">
        <h3 className="bo-chart-title">Funnel de commande</h3>
        <p className="bo-chart-sub">Repère où les visiteurs quittent le parcours. <span className="bo-chart-axis-note">Largeur : part conservée · Valeur : volume</span></p>
      </div>
      <div className="bo-funnel-visual">
        {values.map((step) => {
          const ratio = base ? Math.round((step.value / base) * 100) : 0;
          return (
            <div className="bo-funnel-row" key={step.key}>
              <div className="bo-funnel-row-head">
                <span>{step.label}</span>
                <strong>{formatNumber(step.value)} <small>{base ? `${ratio}%` : "—"}</small></strong>
              </div>
              <div className="bo-funnel-track"><span style={{ width: `${Math.min(100, ratio)}%` }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
