import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../../resources/js/lib/news-engagement.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { copyArticleLink, visibleReadingClock } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('copy uses the public article URL and waits for successful clipboard write', async () => {
    let copied;
    const result = await copyArticleLink(42, 'https://news.example', { writeText: async url => { copied = url; } });
    assert.equal(copied, 'https://news.example/news/42');
    assert.equal(result, 'Link copied to clipboard!');
});
test('clipboard denial and unavailable API provide manual canonical link', async () => {
    for (const clipboard of [undefined, { writeText: async () => { throw new Error('NotAllowedError'); } }]) {
        const result = await copyArticleLink(42, 'https://news.example', clipboard);
        assert.match(result, /https:\/\/news.example\/news\/42/);
        assert.doesNotMatch(result, /Link copied/);
    }
});
test('hidden time does not qualify and visible reading emits only once', () => {
    const clock = visibleReadingClock(0);
    for (let t = 250; t <= 10000; t += 250) assert.equal(clock.tick(t, false), false);
    clock.reset(10000);
    for (let t = 10250; t < 15500; t += 250) assert.equal(clock.tick(t, true), false);
    assert.equal(clock.tick(15500, true), true);
    assert.equal(clock.tick(16000, true), false);
    assert.equal(clock.tick(20000, true), false);
});
test('visibility transitions and suspended timers do not count long gaps', () => {
    const clock = visibleReadingClock(0);
    clock.reset(60000);
    assert.equal(clock.tick(60250, true), false);
    assert.equal(clock.tick(120000, true), false);
});
