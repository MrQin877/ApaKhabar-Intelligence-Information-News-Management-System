import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function compile(path) { return ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText; }
const lib = { exports: {}, URL }; vm.runInNewContext(compile('resources/js/lib/short-publication.ts'), lib);
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
function panel() {
    const slots = []; let cursor = 0; const effects = []; const events = new Map(); const timers = new Map(); const timeouts = new Map(); let timer = 0;
    const requests = []; let response = { result: { attempt_id: 'short-7', pending: true, results: { website: { status: 'published' }, instagram: { status: 'processing' } } } };
    const storage = new Map();
    const context = { exports: {}, sessionStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) }, window: { addEventListener: (n,f) => events.set(n,f), removeEventListener: n => events.delete(n), setInterval: f => { timers.set(++timer,f); return timer; }, clearInterval: id => timers.delete(id), setTimeout: (f,ms)=>{timeouts.set(++timer,{f,ms});return timer;}, clearTimeout:id=>timeouts.delete(id) }, require(name) {
        if (name === 'react') return {
            useState(init) { const i=cursor++; if (!(i in slots)) slots[i]=typeof init==='function'?init():init; return [slots[i], v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}]; },
            useRef(init) { const i=cursor++; return slots[i] ??= {current:init}; },
            useEffect(fn,deps) { const i=cursor++; const prev=slots[i]; if (!prev || deps.some((v,j)=>v!==prev.deps[j])) { effects.push(()=>{prev?.cleanup?.();slots[i]={deps,cleanup:fn()};}); } },
        };
        if (name === '@inertiajs/react') return { usePage: ()=>({props:{auth:{user:{id:42}}}}), Link:'Link' };
        if (name === '@/lib/short-publication') return lib.exports;
        if (name === '@/lib/meta-auth') return { metaRequest: async (...args)=> { requests.push(args); if(response instanceof Error) throw response; return response; } };
        if (name === 'react/jsx-runtime') return require(name);
        return new Proxy({}, {get:(_,k)=>String(k)});
    }};
    vm.runInNewContext(compile('resources/js/components/short-publication-panel.tsx'), context);
    const render=()=>{cursor=0; const tree=context.exports.ShortPublicationPanel(); effects.splice(0).forEach(f=>f());return nodes(tree);}; render();
    return {render, requests, timers, timeouts, storage, response: value=>{response=value;}, receive: detail=>events.get('short-publication')({detail}), async tick(){[...timers.values()].forEach(f=>f());await new Promise(resolve=>setImmediate(resolve));}, advance(ms){[...timeouts].filter(([,value])=>value.ms<=ms).forEach(([id,value])=>{timeouts.delete(id);value.f();});} };
}
test('shared panel fetches real status, opens correct detail, minimizes and stops terminal polling', async()=>{
    const app=panel();app.receive({id:7,title:'Video tujuh',open:true});app.render();await app.tick();
    let view=app.render();let dialog=view.find(n=>n.type==='PublishResultDialog');
    assert.equal(dialog.props.result.attempt_id,'short-7');
    assert.equal(dialog.props.result.results.instagram.status,'processing');
    dialog.props.onDismiss();view=app.render();
    const toggle=view.find(n=>n.type==='Button'&&n.props['aria-label']==='Minimalkan status publikasi');toggle.props.onClick();
    view=app.render();assert.ok(view.find(n=>n.props?.['aria-label']==='Perluas status publikasi'));
    view.find(n=>n.props?.['aria-label']==='Perluas status publikasi').props.onClick();view=app.render();
    view.find(n=>n.type==='Button'&&n.props.children==='Lihat Detail').props.onClick();
    assert.equal(app.render().find(n=>n.type==='PublishResultDialog').key,'7');
    app.response({result:{attempt_id:'short-7',pending:false,results:{website:{status:'published'},instagram:{status:'failed',message:'Ditolak'}}}});
    await app.tick();view=app.render();assert.equal(view.find(n=>n.type==='PublishResultDialog').props.result.results.instagram.status,'failed');
    const count=app.requests.length;await app.tick();assert.equal(app.requests.length,count);assert.equal(app.timers.size,0);
    assert.ok(app.requests.every(([path,...args])=>path==='/admin/short-videos/7/status'&&args.length===0));
    assert.deepEqual(JSON.parse(app.storage.get('short-publications:42')),[{id:7,title:'Video tujuh'}]);
});
test('expanded panel keeps multiple jobs separate and progress reflects terminal platform counts',()=>{
    const app=panel();
    app.receive({id:7,title:'Video tujuh',thumbnail_url:'https://example.com/seven.jpg',result:{attempt_id:'short-7',pending:true,results:{website:{status:'published'},instagram:{status:'processing'},facebook:{status:'queued'}}}});
    app.receive({id:8,title:'Video delapan',result:{attempt_id:'short-8',pending:false,results:{website:{status:'published'},instagram:{status:'not_selected'},facebook:{status:'failed'}}}});
    let view=app.render();
    view.find(n=>n.props?.['aria-label']==='Perluas status publikasi').props.onClick();
    view=app.render();
    assert.match(text(view),/Publikasi Video \(\s*1\s*\)/);
    assert.ok(view.some(n=>n.type==='img'&&n.props.src==='https://example.com/seven.jpg'));
    const bar=view.find(n=>n.props?.role==='progressbar');
    assert.equal(bar.props['aria-valuenow'],3);
    assert.equal(bar.props['aria-valuemax'],5);
    view.find(n=>n.props?.['aria-label']==='Minimalkan status publikasi').props.onClick();
    view=app.render();
    assert.match(text(view),/3 dari 5 platform selesai/);
    assert.ok(view.some(n=>n.type==='VideoPublicationRing'));
});
test('thumbnail comes from the existing status API and persists across navigation',async()=>{
    const app=panel();
    app.response({video:{title:'Video terbaru',thumbnail_url:'https://example.com/cover.jpg'},result:{attempt_id:'short-7',pending:true,results:{website:{status:'published'},instagram:{status:'processing'}}}});
    app.receive({id:7,title:'Video'});app.render();await app.tick();
    const view=app.render();
    assert.ok(view.some(n=>n.type==='img'&&n.props.src==='https://example.com/cover.jpg'));
    assert.equal(JSON.parse(app.storage.get('short-publications:42'))[0].thumbnail_url,'https://example.com/cover.jpg');
    assert.ok(app.requests.length>=1);
    assert.ok(app.requests.every(([path])=>path==='/admin/short-videos/7/status'));
});
test('successful publication disappears after five seconds and stays acknowledged',()=>{
    const app=panel();
    app.receive({id:7,title:'Video',result:{attempt_id:'short-7',pending:false,results:{website:{status:'published'},instagram:{status:'published'},facebook:{status:'not_selected'}}}});
    let view=app.render();
    assert.match(text(view),/Publikasi selesai/);
    assert.ok([...app.timeouts.values()].some(value=>value.ms===5000));
    app.advance(5000);view=app.render();
    assert.equal(view.length,0);
    assert.equal(app.storage.get('short-publications:42'),'[]');
});
test('failed publication stays compact until acknowledged without canceling backend work',()=>{
    const app=panel();
    app.receive({id:7,title:'Video',result:{attempt_id:'short-7',pending:false,results:{website:{status:'published'},instagram:{status:'failed'},facebook:{status:'not_selected'}}}});
    let view=app.render();
    assert.match(text(view),/1 platform gagal/);
    assert.equal(app.timeouts.size,0);
    view.find(n=>n.type==='Button'&&n.props.children==='Tutup').props.onClick();
    view=app.render();assert.equal(view.length,0);
    assert.equal(app.storage.get('short-publications:42'),'[]');
    assert.equal(app.requests.length,0);
});
test('backend pending flag keeps permalink lookup polling even after publication success',()=>{
    assert.equal(lib.exports.publicationActive({pending:true,results:{instagram:{status:'published'}}}),true);
    assert.equal(lib.exports.publicationActive({pending:false,results:{instagram:{status:'uncertain'}}}),false);
    assert.equal(lib.exports.publicationUrl('instagram','failed','https://instagram.com/reel/a'),null);
    assert.equal(lib.exports.publicationUrl('instagram','published','https://instagram.com.evil.test/a'),null);
});
test('processing ring is indeterminate while completed and queued states use backend-driven icons',()=>{
    const css=readFileSync('resources/css/app.css','utf8');
    assert.match(css,/@keyframes video-publication-ring-fill[\s\S]*stroke-dasharray: 0 100;[\s\S]*stroke-dasharray: 100 100;/);
    assert.match(css,/animation: video-publication-ring-fill 2\.4s linear infinite;/);
    assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
    const ctx={exports:{},require:name=>name==='react/jsx-runtime'?require(name):new Proxy({},{get:(_,k)=>String(k)})};
    vm.runInNewContext(compile('resources/js/components/video-publication-indicator.tsx'),ctx);
    for(const status of ['uploading','processing','published','failed','queued','uncertain']) {
        const tree=ctx.exports.VideoPublicationIndicator({status});const icon=tree.props.children[0];
        if(['uploading','processing'].includes(status)) {
            assert.equal(icon.type,ctx.exports.VideoPublicationRing);
            const ring=ctx.exports.VideoPublicationRing();
            assert.equal(ring.type,'svg');
            const [track,arc]=ring.props.children;
            assert.equal(track.type,'circle');
            assert.equal(arc.props.pathLength,'100');
            assert.match(arc.props.className,/video-publication-ring-fill/);
            assert.equal(tree.props.children[1],status==='uploading'?'Mengunggah':'Diproses');
        } else {
            assert.notEqual(icon.type,'svg');
            assert.ok(!icon.props.className.includes('animate-spin'));
        }
        if(status==='published')assert.equal(tree.props.children[1],'Berhasil');
        if(status==='failed')assert.equal(tree.props.children[1],'Gagal');
        if(status==='queued')assert.equal(tree.props.children[1],'Menunggu');
        if(status==='uncertain')assert.equal(tree.props.children[1],'Memeriksa Status');
    }
});

test('temporary status failure stays visible and safe fetching recovers without dispatch', async()=>{
    const app=panel();app.response(new Error('offline'));app.receive({id:7,title:'Video',open:true});app.render();await app.tick();
    let view=app.render();assert.ok(view.some(n=>n.props?.role==='status'));
    app.response({result:{attempt_id:'short-7',pending:false,results:{instagram:{status:'published'}}}});
    view.find(n=>n.type==='Button'&&n.props.children==='Perbarui Status').props.onClick();app.render();await app.tick();
    view=app.render();assert.equal(view.find(n=>n.type==='PublishResultDialog').props.result.results.instagram.status,'published');
    assert.ok(app.requests.every(([path,...args])=>path.endsWith('/status')&&args.length===0));
});
test('video dialog closing stays in editor while list action navigates exactly once',()=>{
    const visits=[];let dismissed=0;
    const ctx={exports:{},require(name){
        if(name==='react')return{useState:()=>[null,()=>{}]};
        if(name==='@inertiajs/react')return{usePage:()=>({props:{}}),router:{visit:path=>visits.push(path)}};
        if(name==='@/lib/short-publication')return lib.exports;
        if(name==='react/jsx-runtime')return require(name);
        return new Proxy({},{get:(_,k)=>String(k)});
    }};
    vm.runInNewContext(compile('resources/js/components/publish-result-dialog.tsx'),ctx);
    const tree=ctx.exports.PublishResultDialog({videoMode:true,result:{attempt_id:'short-7',completion_url:'/admin/news',results:{website:{status:'published',success:true}}},onDismiss:()=>dismissed++});
    tree.props.onOpenChange(false);assert.equal(visits.length,0);assert.equal(dismissed,1);
    nodes(tree).find(n=>n.type==='Button'&&n.props.children==='Lihat Daftar Video').props.onClick();
    assert.deepEqual(visits,['/admin/short-videos']);
});
