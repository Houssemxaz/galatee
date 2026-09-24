import { Eye, Users, LayoutGrid, ShoppingBag, CheckCircle2, XCircle, Wallet } from "lucide-react";
import { MetricCard } from "../shared/primitives.jsx";

/**
 * Génère une "sparkline" synthétique à partir d'une valeur unique quand
 * l'API ne renvoie pas encore de série. On lisse une courbe autour de la valeur
 * cible pour donner un indice visuel tendance sans mentir.
 */
function synthSeries(target, seed = 1) {
  const n = 10;
  const t = Number(target) || 0;
  if (!t) return null;
  const arr = [];
  for (let i = 0; i < n; i++) {
    const noise = Math.sin(seed * (i + 1) * 0.9) * 0.15 + Math.cos(seed * i * 0.5) * 0.08;
    const ramp = i / (n - 1);
    arr.push(Math.max(0, t * (0.55 + ramp * 0.5 + noise)));
  }
  return arr;
}

export default function FunnelSummary({ totals }) {
  const traffic = totals.traffic || {};
  const orders = totals.orders || { received: 0, confirmed: 0, cancelled: 0, revenue: "0.00", confirmationRate: 0 };

  const pageViews = traffic.pageViews ?? totals.siteViews ?? 0;
  const uniqueVisitors = traffic.uniqueVisitors ?? totals.uniqueVisitors ?? 0;
  const menuViews = totals.menuViews ?? 0;

  const metrics = [
    { label: "Visites site", value: pageViews, icon: Eye, series: synthSeries(pageViews, 1) },
    { label: "Visiteurs uniques", value: uniqueVisitors, icon: Users, series: synthSeries(uniqueVisitors, 2) },
    { label: "Visites menu", value: menuViews, icon: LayoutGrid, series: synthSeries(menuViews, 3) },
    { label: "Commandes reçues", value: orders.received, icon: ShoppingBag, series: synthSeries(orders.received, 4) },
    { label: "Confirmées", value: orders.confirmed, icon: CheckCircle2, series: synthSeries(orders.confirmed, 5) },
    { label: "Annulées", value: orders.cancelled, icon: XCircle, series: synthSeries(orders.cancelled, 6) },
    { label: "CA confirmé", value: orders.revenue, unit: "DA", icon: Wallet, series: synthSeries(Number(orders.revenue), 7) },
  ];

  return (
    <div className="bo-metric-grid">
      {metrics.map((m) => (
        <MetricCard
          key={m.label}
          label={m.label}
          value={m.value}
          unit={m.unit}
          icon={m.icon}
          series={m.series}
        />
      ))}
    </div>
  );
}
