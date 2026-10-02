import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = { received: "#c87531", confirmed: "#66836a", cancelled: "#bd5140" };
const LABELS = { received: "Reçues", confirmed: "Confirmées", cancelled: "Annulées" };

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
      {payload.map((entry) => (
        <div key={entry.dataKey} className="bo-chart-tooltip-row">
          <span className="bo-chart-tooltip-dot" style={{ background: entry.color }} />
          <span className="bo-chart-tooltip-name">{LABELS[entry.dataKey]}</span>
          <span className="bo-chart-tooltip-value">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function OrdersChart({ series }) {
  const data = (series || []).map((point) => ({
    period: point.period,
    received: point.orders?.received || 0,
    confirmed: point.orders?.confirmed || 0,
    cancelled: point.orders?.cancelled || 0,
  }));

  if (!data.length) return <p className="bo-empty">Aucune donnée de commande pour cette période.</p>;

  const totals = data.reduce((result, point) => ({
    received: result.received + point.received,
    confirmed: result.confirmed + point.confirmed,
    cancelled: result.cancelled + point.cancelled,
  }), { received: 0, confirmed: 0, cancelled: 0 });

  return (
    <div className="bo-chart-wrap">
      <div className="bo-chart-heading">
        <h3 className="bo-chart-title">Commandes par période</h3>
        <p className="bo-chart-sub">Compare les commandes reçues, confirmées et annulées. <span className="bo-chart-axis-note">X : période · Y : nombre de commandes</span></p>
      </div>
      <div className="bo-chart-summary" aria-label="Totaux des commandes sur la période">
        <div><span>Reçues</span><strong>{totals.received.toLocaleString("fr-FR")}</strong></div>
        <div><span>Confirmées</span><strong>{totals.confirmed.toLocaleString("fr-FR")}</strong></div>
        <div><span>Annulées</span><strong>{totals.cancelled.toLocaleString("fr-FR")}</strong></div>
      </div>
      <div className="bo-chart">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 12, bottom: 28 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(42,36,24,0.08)" />
            <XAxis dataKey="period" tickLine={false} axisLine={{ stroke: "rgba(42,36,24,0.22)" }} tickFormatter={formatDate} tick={{ fontSize: 11, fill: "rgba(42,36,24,0.6)" }} label={{ value: "Période", position: "insideBottom", offset: -16, style: { fill: "rgba(42,36,24,0.58)", fontSize: 11 } }} />
            <YAxis tickLine={false} axisLine={{ stroke: "rgba(42,36,24,0.22)" }} width={42} allowDecimals={false} tick={{ fontSize: 11, fill: "rgba(42,36,24,0.6)" }} label={{ value: "Commandes", angle: -90, position: "insideLeft", offset: 0, style: { fill: "rgba(42,36,24,0.58)", fontSize: 11, textAnchor: "middle" } }} />
            <Tooltip content={<TooltipContent />} cursor={{ fill: "rgba(42,36,24,0.04)" }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 12, color: "rgba(42,36,24,0.7)" }} formatter={(value) => LABELS[value] || value} />
            <Bar dataKey="received" fill={COLORS.received} radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Bar dataKey="confirmed" fill={COLORS.confirmed} radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Bar dataKey="cancelled" fill={COLORS.cancelled} radius={[3, 3, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
