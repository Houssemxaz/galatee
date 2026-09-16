export default function FunnelSummary({ totals }) {
  const traffic = totals.traffic || {};
  const orders = totals.orders || { received: 0, confirmed: 0, cancelled: 0, revenue: "0.00", confirmationRate: 0 };
  const steps = [
    { label: "Visites du site", value: traffic.pageViews ?? totals.siteViews ?? 0 },
    { label: "Visiteurs uniques", value: traffic.uniqueVisitors ?? totals.uniqueVisitors ?? 0 },
    { label: "Visites du menu", value: totals.menuViews ?? 0 },
    { label: "Commandes reçues", value: orders.received },
    { label: "Commandes confirmées", value: orders.confirmed },
    { label: "Commandes annulées", value: orders.cancelled },
    { label: "CA confirmé", value: `${orders.revenue} DA` },
  ];

  return (
    <div className="bo-funnel">
      {steps.map((step) => (
        <div className="bo-funnel-step" key={step.label}>
          <p className="bo-funnel-value">{step.value}</p>
          <p className="bo-funnel-label">{step.label}</p>
        </div>
      ))}
    </div>
  );
}
