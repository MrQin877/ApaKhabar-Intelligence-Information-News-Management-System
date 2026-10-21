import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/short-viewer.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];

function mount() {
    const slots = [];
    let cursor = 0;
    const context = { exports: {}, require(name) {
        if (name === 'react') return {
            useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
            useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
            useEffect() {},
            useCallback(callback) { return callback; },
        };
        if (name === '@inertiajs/react') return { Head: 'Head', Link: 'Link', usePage: () => ({ props: { auth: { user: { id: 1 } } } }) };
        if (name === 'react/jsx-runtime') return require(name);
        return new Proxy({}, { get: (_, key) => String(key) });
    } };
    vm.runInNewContext(compiled, context);
    const props = { short: { id: 7, title: 'Video warga', description: 'Deskripsi', video_url: 'https://res.cloudinary.com/demo/video/upload/7.mp4', thumbnail_url: 'https://res.cloudinary.com/demo/image/upload/7.jpg', view_count: 12, likes_count: 3 }, nextShortId: 8, commentCount: 2, likedByUser: false, canFlagComments: true };
    const render = () => { cursor = 0; return nodes(context.exports.default(props)); };

    return { render };
}

test('desktop comment panel occupies its own grid column and closing restores the original viewer layout', () => {
    const view = mount();
    let current = view.render();
    assert.ok(current.some(node => node.type === 'video' && node.props.src.endsWith('/7.mp4')));
    assert.equal(current.filter(node => node.type === 'ShortComments').length, 0);
    assert.ok(current.some(node => node.props?.className?.includes('md:grid-cols-[minmax(0,360px)_1fr]')));

    current.find(node => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.onClick();
    current = view.render();
    assert.ok(current.some(node => node.props?.className?.includes('lg:grid-cols-[minmax(0,360px)_3.5rem_minmax(0,380px)_3.5rem]')));
    assert.ok(current.some(node => node.type === 'video' && node.props.src.endsWith('/7.mp4')));
    assert.equal(current.filter(node => node.type === 'ShortComments').length, 1);
    assert.equal(current.find(node => node.props?.['aria-label'] === 'Video berikutnya').props.href, '/shorts/8');
    current.find(node => node.type === 'ShortComments').props.onClose();
    current = view.render();
    assert.equal(current.filter(node => node.type === 'ShortComments').length, 0);
    assert.ok(current.some(node => node.props?.className?.includes('md:grid-cols-[minmax(0,360px)_1fr]')));
});
