import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../../resources/js/lib/analytics-widget-sizing.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { widgetBudget } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('two Meta charts share remaining height after statistics and headers', () => {
    const result = widgetBudget({ chrome: 400, plotCount: 2, minPlot: 180, height: 1000, fixed: true });
    assert.equal(result.chartHeight, 300);
    assert.ok(result.rows * 64 - 16 >= 400 + 360);
});
test('narrow reflow increases minimum instead of shrinking labels or adding scrollbars', () => {
    const wide = widgetBudget({ chrome: 160, plotCount: 1, minPlot: 180, height: 400, fixed: true });
    const narrow = widgetBudget({ chrome: 480, plotCount: 1, minPlot: 180, height: 400, fixed: true });
    assert.ok(narrow.rows > wide.rows);
    assert.equal(narrow.chartHeight, 180);
    assert.ok(narrow.rows * 64 - 16 >= 660);
});
test('long distributions keep every row readable', () => {
    const result = widgetBudget({ chrome: 300, plotCount: 1, minPlot: 1480, height: 400, fixed: true });
    assert.equal(result.chartHeight, 1480);
    assert.ok(result.rows > 16);
});
test('mobile uses natural height and empty states reserve their content', () => {
    assert.equal(widgetBudget({ chrome: 300, plotCount: 1, minPlot: 180, height: 0, fixed: false }).chartHeight, 240);
    assert.equal(widgetBudget({ chrome: 550, plotCount: 0, minPlot: 180, height: 0, fixed: true }).rows, 9);
});
