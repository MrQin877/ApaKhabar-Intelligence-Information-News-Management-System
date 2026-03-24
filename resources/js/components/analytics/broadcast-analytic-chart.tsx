import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, CartesianGrid } from "recharts";

const chartData = [
  { month: "Jan", pengumuman: 40, darurat: 20 },
  { month: "Feb", pengumuman: 65, darurat: 30 },
  { month: "Mar", pengumuman: 30, darurat: 45 },
  { month: "Apr", pengumuman: 80, darurat: 25 },
  { month: "May", pengumuman: 50, darurat: 60 },
  { month: "Jun", pengumuman: 70, darurat: 35 },
];

const chartConfig = {
  pengumuman: {
    label: "Pengumuman",
    // chart-1 dark: oklch(0.488 0.243 264.376) → blue/purple
    color: "oklch(0.488 0.243 264.376)",
  },
  darurat: {
    label: "Alert Darurat",
    // chart-2 dark: oklch(0.696 0.17 162.48) → green/teal
    color: "oklch(0.696 0.17 162.48)",
  },
} satisfies ChartConfig;

export function AnalyticsChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Tinjauan Pesan</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">‹</Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">›</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-32 w-full">
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="fillPengumuman" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-pengumuman)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-pengumuman)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillDarurat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-darurat)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-darurat)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="oklch(0.269 0 0)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "oklch(0.708 0 0)" }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="pengumuman"
              stroke="var(--color-pengumuman)"
              strokeWidth={2}
              fill="url(#fillPengumuman)"
            />
            <Area
              type="monotone"
              dataKey="darurat"
              stroke="var(--color-darurat)"
              strokeWidth={2}
              fill="url(#fillDarurat)"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}