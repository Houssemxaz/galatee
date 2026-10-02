import { CartesianGrid, Line, LineChart, XAxis, YAxis, Legend, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  siteViews: "#c87531",
  uniqueVisitors: "#66836a",
  menuViews: "#34412b",
};

const LABELS = {
  siteViews: "Visites du site",
  uniqueVisitors: "Visiteurs uniques",
  menuViews: "Visites du menu",
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
    uniqueVisitors: point.uniqueVisitors || 0,
    menuViews: point.menuViews || 0,
  }));

  if (!data.length) {
    return <p className="bo-empty">Aucune donnée pour cette période.</p>;
  }

  const totals = data.reduce((result, point) => ({
    siteViews: result.siteViews + point.siteViews,
    uniqueVisitors: result.uniqueVisitors + point.uniqueVisitors,
    menuViews: result.menuViews + point.menuViews,
  }), { siteViews: 0, uniqueVisitors: 0, menuViews: 0 });

  return (
    <div className="bo-chart-wrap">
      <div className="bo-chart-heading">
        <h3 className="bo-chart-title">Trafic et découverte</h3>
        <p className="bo-chart-sub">Visites, visiteurs uniques et consultations du menu. <span className="bo-chart-axis-note">X : période · Y : nombre de visites</span></p>
      </div>
      <div className="bo-chart-summary" aria-label="Totaux de trafic sur la période">
        <div><span>Visites</span><strong>{totals.siteViews.toLocaleString("fr-FR")}</strong></div>
        <div><span>Visiteurs uniques</span><strong>{totals.uniqueVisitors.toLocaleString("fr-FR")}</strong></div>
        <div><span>Visites menu</span><strong>{totals.menuViews.toLocaleString("fr-FR")}</strong></div>
      </div>
      <div className="bo-chart">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 12, bottom: 28 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(42,36,24,0.08)" />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={{ stroke: "rgba(42,36,24,0.22)" }}
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: "rgba(42,36,24,0.6)" }}
              label={{ value: "Période", position: "insideBottom", offset: -16, style: { fill: "rgba(42,36,24,0.58)", fontSize: 11 } }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: "rgba(42,36,24,0.22)" }}
              width={30}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "rgba(42,36,24,0.6)" }}
              label={{ value: "Visites", angle: -90, position: "insideLeft", offset: 0, style: { fill: "rgba(42,36,24,0.58)", fontSize: 11, textAnchor: "middle" } }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(42,36,24,0.16)" }} />
            <Legend
              iconType="line"
              wrapperStyle={{ fontSize: 12, paddingTop: 12, color: "rgba(42,36,24,0.7)" }}
              formatter={(value) => LABELS[value] || value}
            />
            <Line type="monotone" dataKey="siteViews" stroke={COLORS.siteViews} strokeWidth={2.4} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="uniqueVisitors" stroke={COLORS.uniqueVisitors} strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="menuViews" stroke={COLORS.menuViews} strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
