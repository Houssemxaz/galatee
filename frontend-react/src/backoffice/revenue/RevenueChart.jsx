import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const CONFIG = {
  revenue: { label: "Revenus (DZD)", color: "var(--bo-accent)" },
};

export default function RevenueChart({ series }) {
  const data = series.map((point) => ({ period: point.period, revenue: Number(point.revenue) }));

  if (!data.length) {
    return <p className="bo-empty">Aucune donnée pour cette période.</p>;
  }

  return (
    <ChartContainer config={CONFIG} className="bo-chart">
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="rgba(204,198,169,0.14)" />
        <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} stroke="rgba(204,198,169,0.6)" />
        <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="rgba(204,198,169,0.6)" width={56} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={2} />
      </BarChart>
    </ChartContainer>
  );
}
