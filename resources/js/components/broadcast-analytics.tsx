import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

type AnalyticsProps = {
    analytics: {
        total_pesan: number;
        dikirim_hari_ini: number;
        rate_terbuka: number;
    };
};

export function AnalyticsSidebar({ analytics }: AnalyticsProps) {
    const metricCards = [
        {
            label: "Total Pesan",
            value: analytics.total_pesan,
            detail: "Total",
        },
        {
            label: "Dikirim Hari Ini",
            value: analytics.dikirim_hari_ini,
            detail: "Hari Ini",
        },
        {
            label: "Rate Dibaca",
            value: `${analytics.rate_terbuka}%`,
            detail: "Audience",
        },
    ];

    return (
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-3">
            {metricCards.map(({ label, value, detail }) => (
                <Card
                    key={label}
                    className="overflow-hidden border-border/60 bg-card shadow-sm gap-0 py-0"
                >
                    {/* Header */}
                    <CardHeader className="border-b border-border/70 px-6 py-5">
                        <CardTitle className="text-base font-semibold text-foreground">
                            {label}
                        </CardTitle>
                    </CardHeader>

                    {/* Metric */}
                    <CardContent className="flex items-center gap-4 px-6 py-6">
                        <span className="text-4xl font-bold tracking-tight text-foreground">
                            {value}
                        </span>

                        <Badge
                            variant="secondary"
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-500"
                        >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            {detail}
                        </Badge>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}