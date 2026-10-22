import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('resources/js/components/publish-result-dialog.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function render(result, videoMode = true) {
    const context = { exports: {}, require(name) {
        if (name === 'react') return { useState: () => [null, () => {}] };
        if (name === '@inertiajs/react') return { usePage: () => ({ props: {} }), router: {} };
        if (name === '@/lib/short-publication') return { publicationUrl: () => null };
        if (name === '@/components/video-publication-indicator') return { VideoPublicationIndicator: ({status}) => ({props:{children: ({published:'Berhasil',failed:'Gagal',queued:'Menunggu',processing:'Diproses',uncertain:'Memeriksa Status',not_selected:'Tidak Dipilih'})[status]}}) };
        if (name === 'react/jsx-runtime') { const runtime=require(name); return {...runtime, jsx:(type,props)=>typeof type==='function'?type(props):runtime.jsx(type,props),jsxs:(type,props)=>typeof type==='function'?type(props):runtime.jsxs(type,props)}; }
        return new Proxy({}, { get: (_, key) => String(key) });
    } };
    vm.runInNewContext(compiled, context);
    const tree = context.exports.PublishResultDialog({ result, videoMode, onRetry() {} });
    const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
    const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
    return { nodes: nodes(tree), text: text(tree) };
}
test('video results retain independent success failure and processing states', () => {
    const view = render({ attempt_id:'one', success:false, results: {
        website:{success:true,status:'published',message:'OK'},
        instagram:{success:false,status:'processing',message:'Processing'},
        facebook:{success:false,status:'failed',message:'Rejected'},
    } });
    assert.match(view.text, /ApaKhabar.*Berhasil/);
    assert.match(view.text, /Instagram.*Diproses/);
    assert.match(view.text, /Facebook.*Gagal/);
    assert.equal(view.nodes.filter(n => n.type === 'Button' && n.props.children === 'Coba Lagi').length, 1);
});
test('video results distinguish queued unselected and uncertain destinations', () => {
    const view = render({ attempt_id:'two', success:false, results: {
        website:{success:false,status:'queued',message:'Waiting'},
        instagram:{success:false,status:'not_selected',message:'Unselected'},
        facebook:{success:false,status:'uncertain',message:'Unknown'},
    } });
    for (const label of ['Menunggu', 'Memeriksa Status', 'Periksa Status']) assert.ok(view.text.includes(label));
    assert.ok(!view.text.includes('Tidak Dipilih'));
});
test('legacy image results retain existing success labels', () => {
    const view = render({ attempt_id:'image', success:true, results:{ application:{success:true,message:'OK'} } }, false);
    assert.ok(view.text.includes('Publikasi Berhasil'));
    assert.ok(view.text.includes('Berhasil diterbitkan'));
    assert.ok(!view.text.includes('Status Publikasi Video'));
});
