import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const richText = {};
vm.runInNewContext(ts.transpileModule(readFileSync('resources/js/lib/rich-text.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: richText });
const compiled = ts.transpileModule(readFileSync('resources/js/components/news-rich-editor.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function mount(initial, maxLength = 2000) {
    const refs = []; let refIndex = 0; let value = initial; let tree;
    const calls = [];
    const context = { exports: {}, document: { execCommand(name, _ui, text) { calls.push([name, text]); refs[0].current.innerHTML += text ?? ''; }, queryCommandState: () => false, queryCommandValue: () => '' }, window: { getSelection: () => null }, require(name) {
        if (name === 'react') return { useRef(initialValue) { const index = refIndex++; return refs[index] ??= { current: initialValue }; }, useState(initialValue) { return [initialValue, () => {}]; }, useEffect() {} };
        if (name === 'react/jsx-runtime') return require(name);
        if (name === '@/lib/rich-text') return richText;
        return new Proxy({}, { get: (_, key) => String(key) });
    } };
    vm.runInNewContext(compiled, context);
    const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
    function render() { refIndex = 0; tree = context.exports.NewsRichEditor({ value, onChange: next => { value = next; }, invalid: false, disabled: false, characterCount: richText.richTextLength(value), maxLength, id: 'short-description', label: 'Konten / Deskripsi' }); return nodes(tree); }
    render();
    refs[0].current = { innerHTML: initial, focus() {}, contains() { return false; } };
    return { render, editor: () => render().find(node => node.props?.id === 'short-description'), refs, calls, get value() { return value; } };
}

test('shared News editor keeps its toolbar and responsive appearance for Shorts', () => {
    const app = mount('<p><strong>Konten berita desa hari ini</strong></p>');
    const nodes = app.render();
    const toolbar = nodes.find(node => node.props?.role === 'group');
    assert.match(toolbar.props['aria-label'], /Konten \/ Deskripsi/i);
    for (const label of ['Tebal', 'Miring', 'Garis bawah', 'Daftar berpoin', 'Daftar bernomor', 'Kutipan', 'Rata kiri', 'Rata tengah', 'Rata kanan']) {
        assert.ok(nodes.some(node => node.props?.['aria-label'] === label));
    }
    assert.ok(nodes.some(node => node.props?.children === 'Minimal 20 karakter'));
    assert.ok(nodes.some(node => String(node.props?.children?.flat?.().join('') ?? '').includes('27/2000 karakter')));
    const resizeArea = nodes.find(node => String(node.props?.className ?? '').includes('resize-y'));
    assert.ok(resizeArea);
    assert.match(resizeArea.props.className, /min-h-40/);
    assert.doesNotMatch(resizeArea.props.className, /resize-x/);
    assert.match(app.editor().props.className, /flex-1 overflow-y-auto/);
    assert.match(app.editor().props.className, /sm:px-5/);
    assert.ok(resizeArea.props.children.some(node => node.props?.className?.includes('text-right')));
});

test('shared editor prevents typing and paste beyond visible text limit', () => {
    const app = mount('<strong>abc</strong>', 5);
    let prevented = false;
    app.editor().props.onBeforeInput({ data: 'def', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    app.editor().props.onPaste({ preventDefault() {}, clipboardData: { getData: () => 'wxyz' } });
    assert.deepEqual(app.calls.at(-1), ['insertText', 'wx']);
    app.render();
    app.refs[0].current.innerHTML = '<strong>abcdef</strong>';
    app.editor().props.onInput();
    assert.equal(app.refs[0].current.innerHTML, '<strong>abc</strong>wx');
});
