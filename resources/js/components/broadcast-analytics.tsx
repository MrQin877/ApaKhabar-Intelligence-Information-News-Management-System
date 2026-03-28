import { AnalyticsChart }  from "./analytics/broadcast-analytic-chart";
import { AnalyticsStats }  from "./analytics/broadcast-analytic-stats";
import { AnalyticsRecent } from "./analytics/broadcast-analytics-recent";

type SidebarProps = {
    analytics: {
        total_pesan: number
        dikirim_hari_ini: number
        rate_terbuka: number
        chart_data: { month: string; pengumuman: number; darurat: number }[]
        recent: RecentItem[]
    }
}

export function AnalyticsSidebar({ analytics }: SidebarProps) {
    return (
        <div className="flex flex-col gap-4">
            <AnalyticsStats
                totalPesan={analytics.total_pesan}
                dikirimHariIni={analytics.dikirim_hari_ini}
                rateTerbuka={analytics.rate_terbuka}
            />
            <AnalyticsChart chartData={analytics.chart_data} />
            <AnalyticsRecent recent={analytics.recent} />
        </div>
    )
}