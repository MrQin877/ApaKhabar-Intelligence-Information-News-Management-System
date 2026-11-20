import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../resources/js/pages/admin/comments.tsx', import.meta.url), 'utf8');
const exports = {};
const jsx = (type, props) => ({ type, props });
vm.runInNewContext(ts.transpileModule(source + '\nexport { CommentDetails, ReviewSignal, sources, sourceOptions };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
    exports, Intl, Date,
    require(name) {
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'react') return { useState: value => [value, () => {}], useRef: value => ({ current: value }) };
        return new Proxy({}, { get: (_, key) => String(key) });
    },
});
function text(node) {
    if (Array.isArray(node)) return node.map(text).join(' ');
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    if (node.type === exports.ReviewSignal) return text(exports.ReviewSignal(node.props));
    return text(node.props?.children);
}
const date = '2026-11-20T08:00:00Z';
const comment = {
    id: 1, user: { name: 'Penulis' }, status: 'published', content: 'Komentar asli',
    created_at: date, history: [], feedback: [], news: null,
    reports: [{ id: 1, category: 'Spam', explanation: 'Promosi berulang', reporter_name: 'Warga Pelapor', created_at: date, resolved_at: null }],
    flags: [{ id: 1, category: 'harassment', explanation: 'Periksa konteks', moderator_name: 'Admin Desa', created_at: date, resolved_at: null }],
};
const detail = (value, pending) => text(exports.CommentDetails({ comment: value, pending, busy: false, onClose() {}, onBusy() {}, onSuccess() {} }));

test('villager reports and admin flags show matching review cards with identity and reasons', () => {
    const rendered = detail(comment, true);
    for (const expected of ['Laporan warga', 'Warga Pelapor', 'Spam', 'Promosi berulang', 'Tanda admin / moderator', 'Admin Desa', 'Periksa konteks', 'Menunggu peninjauan']) {
        assert.ok(rendered.includes(expected), expected);
    }
    assert.ok(exports.sources(comment).includes('Dilaporkan Warga'));
    assert.equal(exports.sourceOptions.some(item => item.value === 'ai'), false);
    assert.doesNotMatch(rendered, /Ditandai AI|Kategori AI|OpenAI|Pemeriksaan otomatis/);
});

test('resolved reports stay in history but leave pending review details', () => {
    const resolved = { ...comment, reports: comment.reports.map(report => ({ ...report, resolved_at: date })), flags: [] };
    assert.ok(!detail(resolved, true).includes('Warga Pelapor'));
    const history = detail(resolved, false);
    assert.ok(history.includes('Warga Pelapor'));
    assert.ok(history.includes('Selesai ditinjau'));
});
