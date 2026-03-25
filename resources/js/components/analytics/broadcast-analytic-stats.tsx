import { Radio, Send, MailOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const stats = [
  { label: "Total Siaran", value: "53", icon: <Radio className="h-4 w-4" /> },
  { label: "Dikirim Hari Ini", value: "7", icon: <Send className="h-4 w-4" /> },
  { label: "Rate Terbuka", value: "68%", icon: <MailOpen className="h-4 w-4" /> },
];

export function AnalyticsStats() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Analisis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.map((stat, i) => (
          <div key={stat.label}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {stat.icon}
                {stat.label}
              </div>
              <span className="text-lg font-bold">{stat.value}</span>
            </div>
            {i < stats.length - 1 && <Separator className="mt-3" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}