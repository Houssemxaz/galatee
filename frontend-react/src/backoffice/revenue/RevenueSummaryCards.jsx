import { Card, CardContent } from "@/components/ui/card";

function delta(current, previous) {
  if (!previous) return null;
  if (previous === 0) return current > 0 ? "+∞%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

export default function RevenueSummaryCards({ dashboard }) {
  const { totals, previousPeriod } = dashboard;
  const revenueDelta = previousPeriod ? delta(Number(totals.revenue), Number(previousPeriod.totals.revenue)) : null;

  const cards = [
    { label: "Revenus", value: `${totals.revenue} ${dashboard.currency}`, delta: revenueDelta },
    { label: "Demandées", value: totals.reservations.requested },
    { label: "Confirmées", value: totals.reservations.confirmed },
    { label: "Annulées", value: totals.reservations.cancelled },
  ];

  return (
    <div className="bo-summary-grid">
      {cards.map((card) => (
        <Card key={card.label} className="bo-summary-card">
          <CardContent>
            <p className="bo-summary-label">{card.label}</p>
            <p className="bo-summary-value">{card.value}</p>
            {card.delta && <p className="bo-summary-delta">{card.delta} vs période précédente</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
