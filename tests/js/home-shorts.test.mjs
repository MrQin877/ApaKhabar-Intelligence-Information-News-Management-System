import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../../resources/js/components/home-shorts.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const context = { exports: {}, require(name) {
    if (name === 'react/jsx-runtime') return require(name);
    return new Proxy({}, { get: (_, key) => String(key) });
} };
vm.runInNewContext(code, context);
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];

test('homepage Shorts keep six responsive cards and link each thumbnail to its published viewer', () => {
    const shorts = Array.from({ length: 6 }, (_, id) => ({ id, title: `Video ${id}`, thumbnail_url: `/cover-${id}.jpg`, video_url: `/video-${id}.mp4`, view_count: id === 0 ? 1234 : id }));
    const view = nodes(context.exports.HomeShorts({ shorts }));
    const cards = view.filter(node => node.type === 'Link');
    assert.equal(cards.length, 6);
    assert.deepEqual(cards.map(card => card.props.href), shorts.map(short => `/shorts/${short.id}`));
    assert.ok(view.some(node => node.props?.className?.includes('lg:grid-cols-6')));
    assert.ok(cards.every(card => nodes(card).some(node => node.props?.className?.includes('aspect-[9/16]'))));
    assert.ok(cards.every(card => nodes(card).some(node => node.type === 'img')));
});

test('Shorts subtitle precedes cards and counts are rendered over thumbnail rather than as impressions', () => {
    const view = nodes(context.exports.HomeShorts({ shorts: [{ id: 7, title: 'Desa', thumbnail_url: '/cover.jpg', video_url: '/video.mp4', view_count: 1234 }] }));
    const subtitle = view.findIndex(node => node.type === 'p' && node.props.children === 'Video pendek terbaru dari ApaKhabar.');
    const card = view.findIndex(node => node.type === 'Link');
    assert.ok(subtitle >= 0 && subtitle < card);
    assert.ok(nodes(view[card]).some(node => node.props?.['aria-label'] === '1.234 tayangan' && node.props.children[1] === '1.2K'));
    assert.equal(view.filter(node => node.type === 'p' && node.props.children === 'Video pendek terbaru dari ApaKhabar.').length, 1);
});
