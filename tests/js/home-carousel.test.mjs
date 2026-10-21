import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../../resources/js/components/home-featured-carousel.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function mount(items) {
    const states = [];
    let cursor = 0;
    let effect;
    let cleanup;
    let timer;
    let tree;
    let clock = 0;
    const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
    const context = { exports: {}, document, performance: { now: () => clock }, window: {
        setInterval(callback, delay) { assert.equal(delay, 50); timer = callback; return 1; },
        clearInterval() { timer = undefined; },
    }, require(name) {
        if (name === 'react') return {
            useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
            useRef(initial) { const index = cursor++; if (!(index in states)) states[index] = { current: initial }; return states[index]; },
            useEffect(callback) { effect = callback; },
        };
        if (name === 'react/jsx-runtime') return require(name);
        return new Proxy({}, { get: (_, key) => String(key) });
    } };
    vm.runInNewContext(code, context);
    function render() { cleanup?.(); cursor = 0; tree = context.exports.HomeFeaturedCarousel({ items }); cleanup = effect?.(); }
    function nodes(node = tree) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(item => nodes(item)) : [node, ...nodes(node.props?.children ?? null)]; }
    render();
    return {
        render, document,
        tick() { for (let i = 0; i < 100; i++) { clock += 50; timer?.(); } render(); },
        get running() { return !!timer; },
        get root() { return tree; },
        get selected() { return nodes().filter(n => n.type === 'button' && n.props['aria-pressed']).map(n => n.props['aria-label']); },
        click(label) { const node = nodes().find(n => n.props?.['aria-label'] === label); assert.ok(node, label); node.props.onClick(); render(); },
    };
}
const items = ['A', 'B', 'C'].map(id => ({ id, title: id, category: 'Desa', image: '/test.webp', preview: 'News' }));

test('autoplay advances every five seconds, wraps and supports manual selection', () => {
    const view = mount(items);
    assert.deepEqual(view.selected, ['Tampilkan A']);
    view.tick(); assert.deepEqual(view.selected, ['Tampilkan B']);
    view.click('Tampilkan C'); assert.deepEqual(view.selected, ['Tampilkan C']);
    view.tick(); assert.deepEqual(view.selected, ['Tampilkan A']);
    view.click('Tampilkan B'); assert.deepEqual(view.selected, ['Tampilkan B']);
});

test('hover and focus pause autoplay; hidden tabs do not advance', () => {
    const view = mount(items);
    view.root.props.onMouseEnter(); view.render(); assert.equal(view.running, false);
    view.root.props.onMouseLeave(); view.render(); assert.equal(view.running, true);
    view.root.props.onFocusCapture(); view.render(); assert.equal(view.running, false);
    view.root.props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null }); view.render();
    view.document.hidden = true; view.tick(); assert.deepEqual(view.selected, ['Tampilkan A']);
});

test('empty and single-item carousels do not start autoplay', () => {
    assert.equal(mount([]).running, false);
    assert.equal(mount(items.slice(0, 1)).running, false);
});


test('homepage category pills filter the latest list and Latest restores every remaining story', () => {
    const welcome = readFileSync(new URL('../../resources/js/pages/welcome.tsx', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(welcome, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const states = [];
    let cursor = 0;
    const context = { exports: {}, require(name) {
        if (name === 'react') return { useEffect() {}, useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = value; }]; } };
        if (name === '@inertiajs/react') return { Head: 'Head', Link: 'Link', usePage: () => ({ props: { categories: ['Desa', 'Budaya'] } }) };
        if (name === 'react/jsx-runtime') return require(name);
        return new Proxy({}, { get: (_, key) => String(key) });
    } };
    vm.runInNewContext(compiled, context);
    const props = { remainingNews: [items[0], { ...items[1], category: 'Budaya' }], breakingNews: null, breakingSentAt: null };
    let tree;
    function render() { cursor = 0; tree = context.exports.default(props); }
    function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
    function links() { return nodes(tree).filter(n => n.type === 'Link').map(n => n.props.href); }
    render(); assert.deepEqual(links(), ['/news/A', '/news/B']);
    nodes(tree).find(n => n.type === 'Button' && n.props.children === 'Budaya').props.onClick();
    render(); assert.deepEqual(links(), ['/news/B']);
    nodes(tree).find(n => n.type === 'Button' && n.props.children === 'Latest').props.onClick();
    render(); assert.deepEqual(links(), ['/news/A', '/news/B']);
});


test('Shorts renders exactly six linked previews with titles outside their portrait covers', () => {
    const source = readFileSync(new URL('../../resources/js/components/home-shorts.tsx', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const context = { exports: {}, require(name) {
        if (name === 'react/jsx-runtime') return require(name);
        return new Proxy({}, { get: (_, key) => String(key) });
    } };
    vm.runInNewContext(compiled, context);
    function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
    const elements = nodes(context.exports.HomeShorts({ shorts: Array.from({ length: 6 }, (_, id) => ({ id, title: `Video ${id}`, thumbnail_url: `/cover-${id}.jpg`, video_url: `/video-${id}.mp4` })) }));
    const cards = elements.filter(node => node.type === 'Link');
    assert.equal(cards.length, 6);
    for (const card of cards) {
        assert.equal(card.props.children[1].type, 'h3');
        assert.equal(nodes(card).filter(node => node.type === 'img').length, 1);
    }
    assert.equal(elements.filter(node => node.type === 'button' || node.type === 'Button').length, 0);
});
