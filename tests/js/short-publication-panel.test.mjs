import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('workload panel persists News and Video with typed keys across navigation', () => {
    const source = readFileSync('resources/js/components/short-publication-panel.tsx', 'utf8');
    assert.match(source, /const jobKey = .*`\$\{kind\}:\$\{id\}`/);
    assert.match(source, /publication-workloads:/);
    assert.match(source, /sessionStorage\.setItem/);
    assert.match(source, /window\.addEventListener\('short-publication'/);
    assert.match(source, /window\.addEventListener\('news-publication'/);
});
