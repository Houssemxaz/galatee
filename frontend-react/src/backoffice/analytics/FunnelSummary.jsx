import { Eye, Users, LayoutGrid, ShoppingBag, CheckCircle2, XCircle, Wallet } from "lucide-react";
import { MetricCard } from "../shared/primitives.jsx";

function changePercent(current, previous) {
  const value = Number(current) || 0;
  const oldValue = Number(previous) || 0;
  if (!oldValue) return null;
  return Math.round(((value - oldValue) / oldValue) * 100);
}

export default function FunnelSummary({ totals, previousTotals, series }) {
  const traffic = totals.traffic || {};
  const orders = totals.orders || { received: 0, confirmed: 0, cancelled: 0, revenue: "0.00", confirmationRate: 0 };
  const previousTraffic = previousTotals?.traffic || {};
  const previousOrders = previousTotals?.orders || {};

  const pageViews = traffic.pageViews ?? totals.siteViews ?? 0;
  const uniqueVisitors = traffic.uniqueVisitors ?? totals.uniqueVisitors ?? 0;
  const menuViews = totals.menuViews ?? 0;
  const toSeries = (read) => (series || []).map(read);

  const metrics = [
    { label: "Visites site", value: pageViews, icon: Eye, delta: changePercent(pageViews, previousTotals?.siteViews ?? previousTraffic.pageViews), series: toSeries((point) => point.siteViews || 0) },
    { label: "Visiteurs uniques", value: uniqueVisitors, icon: Users, delta: changePercent(uniqueVisitors, previousTotals?.uniqueVisitors ?? previousTraffic.uniqueVisitors), series: toSeries((point) => point.uniqueVisitors || 0) },
    { label: "Visites menu", value: menuViews, icon: LayoutGrid, delta: changePercent(menuViews, previousTotals?.menuViews), series: toSeries((point) => point.menuViews || 0) },
    { label: "Commandes reçues", value: orders.received, icon: ShoppingBag, delta: changePercent(orders.received, previousOrders.received), series: toSeries((point) => point.orders?.received || 0) },
    { label: "Confirmées", value: orders.confirmed, icon: CheckCircle2, delta: changePercent(orders.confirmed, previousOrders.confirmed), series: toSeries((point) => point.orders?.confirmed || 0) },
    { label: "Annulées", value: orders.cancelled, icon: XCircle, delta: changePercent(orders.cancelled, previousOrders.cancelled), series: toSeries((point) => point.orders?.cancelled || 0) },
    { label: "CA confirmé", value: orders.revenue, unit: "DA", icon: Wallet, delta: changePercent(orders.revenueCents, previousOrders.revenueCents), series: toSeries((point) => Number(point.revenueCents || 0) / 100) },
  ];

  return (
    <div className="bo-metric-grid">
      {metrics.map((m) => (
        <MetricCard
          key={m.label}
          label={m.label}
          value={m.value}
          unit={m.unit}
          delta={m.delta}
          icon={m.icon}
          series={m.series}
        />
      ))}
    </div>
  );
}
