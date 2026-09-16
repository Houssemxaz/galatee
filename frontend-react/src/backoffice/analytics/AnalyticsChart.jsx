import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  siteViews: "#6d6844",
  menuViews: "#83482b",  // terracotta
  confirmed: "#4a6b3f",  // olive green
  cancelled: "#a55a34",
};

const LABELS = {
  siteViews: "Visites du site",
  menuViews: "Visites du menu",
  orderSubmitted: "Commandes reçues",
  confirmed: "Commandes confirmées",
  cancelled: "Commandes annulées",
};

function formatDate(iso) {
  if (!iso) return "";
  if (iso.length === 7) {
    const [y, m] = iso.split("-");
    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    return `${months[Number(m) - 1]} ${y.slice(2)}`;
  }
  if (iso.length === 10) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }
  return iso;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bo-chart-tooltip">
      <p className="bo-chart-tooltip-label">{formatDate(label)}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="bo-chart-tooltip-row">
          <span className="bo-chart-tooltip-dot" style={{ background: entry.color }} />
          <span className="bo-chart-tooltip-name">{LABELS[entry.dataKey] || entry.dataKey}</span>
          <span className="bo-chart-tooltip-value">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsChart({ series }) {
  const data = (series || []).map((point) => ({
    period: point.period,
    siteViews: point.siteViews || 0,
    menuViews: point.menuViews || 0,
    orderSubmitted: point.orders?.received || 0,
    confirmed: point.orders?.confirmed || 0,
    cancelled: point.orders?.cancelled || 0,
  }));

  if (!data.length) {
    return <p className="bo-empty">Aucune donnée pour cette période.</p>;
  }

  return (
    <div className="bo-chart-wrap">
      <div className="bo-chart-heading">
        <h3 className="bo-chart-title">Activité par période</h3>
        <p className="bo-chart-sub">Trafic et activité commerciale sur la période sélectionnée</p>
      </div>
      <div className="bo-chart">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(42,36,24,0.08)" />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={false}
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: "rgba(42,36,24,0.6)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={30}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "rgba(42,36,24,0.6)" }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(42,36,24,0.04)" }} />
            <Legend
              iconType="square"
              wrapperStyle={{ fontSize: 12, paddingTop: 12, color: "rgba(42,36,24,0.7)" }}
              formatter={(value) => LABELS[value] || value}
            />
            <Bar dataKey="siteViews" fill={COLORS.siteViews} radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Bar dataKey="menuViews" fill={COLORS.menuViews} radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Bar dataKey="orderSubmitted" fill={COLORS.menuViews} radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Bar dataKey="confirmed" fill={COLORS.confirmed} radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Bar dataKey="cancelled" fill={COLORS.cancelled} radius={[3, 3, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
