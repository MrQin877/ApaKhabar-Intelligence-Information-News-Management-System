import { AreaChart, Area, XAxis, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ChartConfig} from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
/*
const chartData = [
  { month: "Jan", pengumuman: 40, darurat: 20 },
  { month: "Feb", pengumuman: 65, darurat: 30 },
  { month: "Mar", pengumuman: 30, darurat: 45 },
  { month: "Apr", pengumuman: 80, darurat: 25 },
  { month: "May", pengumuman: 50, darurat: 60 },
  { month: "Jun", pengumuman: 70, darurat: 35 },
];
*/

const chartConfig = {
  pengumuman: {
    label: "Pengumuman",
    color: "var(--chart-5)",
  },
  darurat: {
    label: "Alert Darurat",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

type ChartProps = {
    chartData: { month: string; pengumuman: number; darurat: number }[]
}

export function AnalyticsChart({ chartData }: ChartProps) {
  return (
    <Card className="h-full w-full">
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
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
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