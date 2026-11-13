import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright-core')); } catch {
    try { ({ chromium } = require('../../deployment/runtime-test/browser-check/node_modules/playwright-core')); } catch { /* Optional browser test dependency. */ }
}
const moduleCode = ts.transpileModule(readFileSync('resources/js/lib/translation/website-translator.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test('formatted long articles, retry, dynamic content, source hints and language cleanup', { skip: !chromium }, async () => {
    const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE ?? (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined), headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent('<article lang="id"><h1>Kerajaan membuka sekolah baharu</h1><p id="long"></p><p><strong>Berita pendidikan</strong> untuk masyarakat.</p><img alt="Sekolah baharu"><input value="Original draft" placeholder="Cari berita"></article>');
        const result = await page.evaluate(async ({ moduleCode }) => {
            const text = Array.from({ length: 35 }, (_, i) => `Perenggan ${i}: ` + 'Murid belajar di sekolah baharu. '.repeat(10)).join('\n\n');
            document.querySelector('#long').textContent = text;
            const original = document.body.innerHTML;
            const calls = []; const states = []; let remainingFailures = 0;
            window.exports = {};
            window.require = (name) => name === '@/lib/api' ? { apiFetch: async (_url, options) => {
                const data = JSON.parse(options.body); calls.push(data);
                if (remainingFailures-- > 0) return new Response('{}', { status: 503 });
                return new Response(JSON.stringify({ translations: data.texts.map((text) => `${data.target}:${text.trim()}`) }), { status: 200 });
            } } : { uiTranslation: () => undefined };
            new Function(moduleCode)();
            const start = (language) => window.exports.translateWebsite(language, (state) => states.push(state));
            const wait = async (state) => {
                const end = Date.now() + 15000;
                while (states.at(-1) !== state && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 30));
                if (states.at(-1) !== state) throw Error(`Expected ${state}: ${states}; remaining=${remainingFailures}; calls=${calls.length}; body=${document.body.innerHTML.slice(0,200)}`);
            };
            let stop = start('en'); await wait('ready');
            const translated = document.querySelector('#long').textContent;
            const formatting = document.querySelectorAll('strong').length === 1 && document.querySelector('input').value === 'Original draft';
            const attempts = calls.length; await new Promise((resolve) => setTimeout(resolve, 500));
            const noLoop = calls.length === attempts;
            const everyParagraph = Array.from({ length: 35 }, (_, i) => translated.includes(`Perenggan ${i}:`)).every(Boolean);
            const breaks = (translated.match(/\n\n/g) || []).length;
            const sourceHints = calls.every((call) => call.source === 'id');
            const limits = calls.every((call) => call.texts.length <= 4 && call.texts.reduce((sum, text) => sum + text.length, 0) <= 1400);
            stop(); const restored = document.body.innerHTML === original;
            states.length = 0; stop = start('id'); await wait('ready'); const switched = document.querySelector('h1').textContent === 'Kerajaan membuka sekolah baharu'; stop();
            document.querySelector('#long').remove(); document.querySelector('h1').textContent = 'Laporan pendidikan terbaru'; states.length = 0; remainingFailures = 1000; stop = start('en'); await wait('error');
            const fallback = document.querySelector('h1').textContent === 'Laporan pendidikan terbaru';
            const failedCalls = calls.length; const oneFailedRequest = calls.length === attempts + 1; await new Promise((resolve) => setTimeout(resolve, 600)); const bounded = failedCalls === calls.length; stop();
            remainingFailures = 0; states.length = 0; stop = start('en'); await wait('ready');
            states.length = 0; const dynamic = document.createElement('p'); dynamic.textContent = 'Berita terkini untuk penduduk'; document.querySelector('article').append(dynamic); await wait('ready');
            const dynamicTranslated = dynamic.textContent.startsWith('en:'); stop();
            return { formatting, noLoop, everyParagraph, breaks, sourceHints, limits, restored, switched, fallback, bounded, oneFailedRequest, dynamicTranslated, states };
        }, { moduleCode });
        assert.equal(result.breaks, 34);
        for (const [key, value] of Object.entries(result)) if (!['breaks', 'states'].includes(key)) assert.equal(value, true, key);
        console.log(JSON.stringify(result));
    } finally { await browser.close(); }
});



