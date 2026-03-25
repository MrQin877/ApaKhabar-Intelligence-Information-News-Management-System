import { AnalyticsChart }  from "./analytics/broadcast-analytic-chart";
import { AnalyticsStats }  from "./analytics/broadcast-analytic-stats";
import { AnalyticsRecent } from "./analytics/broadcast-analytics-recent";

export function AnalyticsSidebar() {
  return (
    <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
            <AnalyticsStats />
            <AnalyticsRecent />
        </div>
      <AnalyticsChart />
    </div>
  );
}