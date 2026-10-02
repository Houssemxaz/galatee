import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatDate(value) {
  if (!value) return "";
  if (value.length === 7) return value.slice(5);
  if (value.length === 10) return `${value.slice(8)}/${value.slice(5, 7)}`;
  return value;
}

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bo-chart-tooltip">
      <p className="bo-chart-tooltip-label">{formatDate(label)}</p>
      <div className="bo-chart-tooltip-row">
        <span className="bo-chart-tooltip-dot" style={{ background: "#d99b45" }} />
        <span className="bo-chart-tooltip-name">CA confirmé</span>
        <span className="bo-chart-tooltip-value">{Number(payload[0].value || 0).toLocaleString("fr-FR")} DA</span>
      </div>
    </div>
  );
}

export default function StatsRevenueChart({ series }) {
  const data = (series || []).map((point) => ({
    period: point.period,
    revenue: (Number(point.revenueCents || point.orders?.revenueCents || 0) / 100),
  }));

  if (!data.length) return <p className="bo-empty">Aucune donnée de chiffre d’affaires pour cette période.</p>;

  const total = data.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <div className="bo-chart-wrap">
      <div className="bo-chart-heading">
        <h3 className="bo-chart-title">Chiffre d’affaires confirmé</h3>
        <p className="bo-chart-sub">Montant issu des commandes confirmées, hors annulations. <span className="bo-chart-axis-note">X : période · Y : chiffre d’affaires en DA</span></p>
      </div>
      <div className="bo-chart-summary bo-chart-summary-single" aria-label="Chiffre d’affaires total sur la période">
        <div><span>Total confirmé</span><strong>{total.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} DA</strong></div>
      </div>
      <div className="bo-chart">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 20, bottom: 28 }}>
            <defs>
              <linearGradient id="bo-stats-revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d99b45" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#d99b45" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(42,36,24,0.08)" />
            <XAxis dataKey="period" tickLine={false} axisLine={{ stroke: "rgba(42,36,24,0.22)" }} tickFormatter={formatDate} tick={{ fontSize: 11, fill: "rgba(42,36,24,0.6)" }} label={{ value: "Période", position: "insideBottom", offset: -16, style: { fill: "rgba(42,36,24,0.58)", fontSize: 11 } }} />
            <YAxis tickLine={false} axisLine={{ stroke: "rgba(42,36,24,0.22)" }} width={56} tickFormatter={(value) => Number(value).toLocaleString("fr-FR")} tick={{ fontSize: 11, fill: "rgba(42,36,24,0.6)" }} label={{ value: "DA", angle: -90, position: "insideLeft", offset: -2, style: { fill: "rgba(42,36,24,0.58)", fontSize: 11, textAnchor: "middle" } }} />
            <Tooltip content={<TooltipContent />} cursor={{ stroke: "rgba(42,36,24,0.16)" }} />
            <Area type="monotone" dataKey="revenue" stroke="#d99b45" strokeWidth={2.4} fill="url(#bo-stats-revenue-fill)" dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
