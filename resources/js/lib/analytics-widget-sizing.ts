/** Reserve non-chart content before distributing vertical space among charts. */
export function widgetBudget({
    chrome,
    plotCount,
    minPlot,
    height,
    fixed,
}: {
    chrome: number;
    plotCount: number;
    minPlot: number;
    height: number;
    fixed: boolean;
}) {
    return {
        rows: Math.max(4, Math.ceil((chrome + plotCount * minPlot + 16) / 64)),
        chartHeight: Math.max(
            minPlot,
            Math.floor(
                (fixed ? height - chrome : plotCount * 240) /
                    Math.max(1, plotCount),
            ),
        ),
    };
}
