import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('resources/js/components/short-video-list.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const richText = {};
vm.runInNewContext(ts.transpileModule(readFileSync('resources/js/lib/rich-text.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: richText });
function mount(data = []) {
    const state = []; let cursor = 0; const visits = []; const actions = [];
    const context = { exports: {}, URL, require(name) {
        if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; } };
        if (name === '@inertiajs/react') return { Link: 'Link', router: { get: (...args) => visits.push(args) } };
        if (name === 'react/jsx-runtime') return require(name);
        if (name === '@/lib/rich-text') return richText;
        return new Proxy({}, { get: (_, key) => String(key) });
    } };
    vm.runInNewContext(compiled, context);
    const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
    const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
    function render() { cursor = 0; const tree = context.exports.ShortVideoList({ videos: { data, current_page: 1, last_page: 2 }, filters: { search: '', status: 'all' }, onStatus: item => actions.push(item), onAction: (item, action) => actions.push({item, action}), busy: false }); return { nodes: nodes(tree), text: text(tree) }; }
    return { render, visits, actions, exports: context.exports, text };
}
const video = { id: 1, title: 'Festival desa', description: 'Deskripsi lengkap', status: 'published', video_url: 'https://res.cloudinary.com/demo/video/upload/a.mp4', thumbnail_url: 'https://res.cloudinary.com/demo/image/upload/a.jpg', publications: [{ platform: 'website', status: 'published' }, { platform: 'instagram', status: 'failed' }] };
test('list search filters pagination and loading use server navigation', () => {
    const app = mount(); let view = app.render();
    assert.match(view.text, /Belum ada video/);
    view.nodes.find(n => n.type === 'Input').props.onChange({ target: { value: 'Festival' } });
    view = app.render(); view.nodes.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(app.visits[0][1].search, 'Festival');
    view.nodes.find(n => n.type === 'Tabs').props.onValueChange('archived');
    assert.equal(app.visits[1][1].status, 'archived');
    view.nodes.find(n => n.type === 'Button' && n.props.children === 'Berikutnya').props.onClick();
    assert.equal(app.visits[2][1].page, 2);
    app.visits[0][2].onStart(); assert.match(app.render().text, /Memuat video/);
    app.visits[0][2].onError(); assert.match(app.render().text, /gagal dimuat/);
});
test('published cards show thumbnail description and playable details without publishing', () => {
    const app = mount([video]); let view = app.render();
    assert.match(view.text, /Festival desa.*Deskripsi lengkap.*Terbit/);
    assert.equal(view.nodes.find(n => n.type === 'img').props.src, video.thumbnail_url);
    view.nodes.find(n => n.type === 'Button' && n.props.children === 'Detail Video').props.onClick();
    view = app.render();
    assert.equal(view.nodes.find(n => n.type === 'video').props.src, video.video_url);
    assert.equal(app.visits.length, 0); assert.equal(app.actions.length, 0);
});
test('untitled drafts show a placeholder without changing the saved title', () => {
    const app = mount([{ ...video, title: null, status: 'draft' }]);
    const view = app.render();
    assert.match(view.text, /Belum ada judul/);
    assert.equal(view.nodes.find(n => n.type === 'Link').props.href, '/admin/short-videos/create?draft=1');
});
test('draft primary action preserves draft ID and archived cards remain accessible', () => {
    const app = mount([{ ...video, status: 'draft' }, { ...video, id: 2, status: 'archived' }]); const view = app.render();
    assert.equal(view.nodes.find(n => n.type === 'Link').props.href, '/admin/short-videos/create?draft=1');
    assert.match(view.text, /Diarsipkan/);
});
test('only real safe successful publication permalinks become links', () => {
    const { publicationUrl: url } = mount().exports;
    assert.equal(url('website', 'published', null, false, 1), '/shorts/1');
    assert.equal(url('website', 'published'), null);
    assert.equal(url('website', 'published', null, true), null);
    assert.equal(url('instagram', 'published', 'https://www.instagram.com/reel/real/'), 'https://www.instagram.com/reel/real/');
    for (const status of ['failed', 'processing', 'queued', 'uncertain', 'not_selected']) assert.equal(url('facebook', status, 'https://www.facebook.com/reel/1'), null);
    for (const unsafe of ['javascript:alert(1)', 'https://instagram.com.evil.test/reel/1', 'https://evil.test/', '']) assert.equal(url('instagram', 'published', unsafe), null);
});
test('published ApaKhabar destination opens the selected video detail', () => {
    const view = mount([video]).render();
    const link = view.nodes.find(n => n.type === 'a' && n.props.href === '/shorts/1');
    assert.ok(link);
    assert.equal(view.nodes.find(n => n.type === 'Link' && n.props.children === 'Lihat Video').props.href, '/shorts/1');
    assert.equal(view.nodes.some(n => n.type === 'Link' && String(n.props.href).includes('create?draft=')), false);
});

test('processing and failed videos open progress or details without an editor link', () => {
    const app = mount([{ ...video, status: 'processing' }, { ...video, id: 2, status: 'failed' }]);
    let view = app.render();
    view.nodes.find(n => n.type === 'Button' && n.props.children === 'Lihat Progres').props.onClick();
    assert.equal(app.actions[0].id, 1);
    view.nodes.find(n => n.type === 'Button' && n.props.children === 'Lihat Status').props.onClick();
    view = app.render();
    assert.match(view.text, /Detail Video/);
    assert.equal(view.nodes.some(n => n.type === 'Link' && String(n.props.href).includes('create?draft=')), false);
});
test('every platform status has an accessible label and processing animates', () => {
    const { VideoPlatformStatus } = mount().exports;
    for (const status of ['published', 'processing', 'queued', 'failed', 'uncertain', 'not_selected']) {
        const node = VideoPlatformStatus({ platform: 'instagram', status });
        assert.match(node.props['aria-label'], /Instagram Reels:/);
        if (status === 'processing') assert.match(node.props.children[1].props.className, /animate-spin/);
    }
});

test('retry dialog selects only eligible failed destinations and cancellation does not dispatch', () => {
    const app = mount([{ ...video, publications: [
        { platform: 'website', status: 'published', can_retry: false },
        { platform: 'instagram', status: 'failed', can_retry: true },
        { platform: 'facebook', status: 'uncertain', can_retry: false },
    ] }]);
    let view = app.render();
    view.nodes.find(n => n.type === 'DropdownMenuItem' && n.props.children === 'Coba Publikasikan Lagi').props.onSelect();
    view = app.render();
    const boxes = view.nodes.filter(n => n.type === 'input' && n.props.type === 'checkbox');
    assert.deepEqual(boxes.map(n => n.props.disabled), [true, false, true]);
    boxes[1].props.onChange({ target: { checked: true } });
    view = app.render();
    assert.equal(view.nodes.filter(n => n.type === 'input')[1].props.checked, true);
    view.nodes.find(n => n.type === 'Button' && n.props.children === 'Batal').props.onClick();
    assert.equal(app.render().nodes.find(n => n.type === 'Dialog').props.open, false);
    assert.equal(app.visits.length, 0);
});
test('management menus show state appropriate actions and hide unsafe retries', () => {
    const app = mount([{ ...video, status: 'draft' }, { ...video, id: 2, status: 'archived' }, video]);
    const view = app.render();
    assert.match(view.text, /Edit Draf/); assert.match(view.text, /Hapus Draf/);
    assert.match(view.text, /Pulihkan Video/); assert.match(view.text, /Arsipkan Video/);
    assert.equal(view.nodes.some(n => n.type === 'DropdownMenuItem' && n.props.children === 'Coba Publikasikan Lagi'), false);
});

test('archive selection requests confirmation rather than making a publishing request', () => {
    const app = mount([video]);
    const view = app.render();
    view.nodes.find(n => n.type === 'DropdownMenuItem' && n.props.children === 'Arsipkan Video').props.onSelect();
    assert.equal(app.actions[0].action, 'archive');
    assert.equal(app.visits.length, 0);
});

test('Facebook saved permalink enables its dropdown and missing links explain availability', () => {
    const url='https://www.facebook.com/reel/provider-returned/';
    const ready=mount([{...video,publications:[{platform:'facebook',status:'published',permalink:url}]}]).render();
    const link=ready.nodes.find(n=>n.type==='a'&&n.props.href===url);
    assert.equal(link.props.target,'_blank');
    const pending=mount([{...video,publications:[{platform:'facebook',status:'published',permalink:null}]}]).render();
    assert.match(pending.text,/Facebook Reels.*Tautan belum tersedia/);
    assert.equal(pending.nodes.some(n=>n.type==='a'&&n.props.href===url),false);
    for(const status of ['processing','failed']) {
        const view=mount([{...video,publications:[{platform:'facebook',status,permalink:url}]}]).render();
        assert.equal(view.nodes.some(n=>n.type==='a'&&n.props.href===url),false);
    }
});
