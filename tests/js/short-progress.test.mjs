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
function panel() {
    const slots = []; let cursor = 0; const effects = []; const events = new Map(); const timers = new Map(); let timer = 0;
    const requests = []; let response = { result: { attempt_id: 'short-7', pending: true, results: { website: { status: 'published' }, instagram: { status: 'processing' } } } };
    const storage = new Map();
    const context = { exports: {}, sessionStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) }, window: { addEventListener: (n,f) => events.set(n,f), removeEventListener: n => events.delete(n), setInterval: f => { timers.set(++timer,f); return timer; }, clearInterval: id => timers.delete(id) }, require(name) {
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
    return {render, requests, timers, storage, response: value=>{response=value;}, receive: detail=>events.get('short-publication')({detail}), async tick(){[...timers.values()].forEach(f=>f());await new Promise(resolve=>setImmediate(resolve));} };
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
test('backend pending flag keeps permalink lookup polling even after publication success',()=>{
    assert.equal(lib.exports.publicationActive({pending:true,results:{instagram:{status:'published'}}}),true);
    assert.equal(lib.exports.publicationActive({pending:false,results:{instagram:{status:'uncertain'}}}),false);
    assert.equal(lib.exports.publicationUrl('instagram','failed','https://instagram.com/reel/a'),null);
    assert.equal(lib.exports.publicationUrl('instagram','published','https://instagram.com.evil.test/a'),null);
});
test('animated video indicator uses confirmed status, including uploading and uncertain',()=>{
    const ctx={exports:{},require:name=>name==='react/jsx-runtime'?require(name):new Proxy({},{get:(_,k)=>String(k)})};
    vm.runInNewContext(compile('resources/js/components/video-publication-indicator.tsx'),ctx);
    for(const status of ['uploading','processing','published','failed','queued','uncertain']) {
        const tree=ctx.exports.VideoPublicationIndicator({status});const icon=tree.props.children[0];
        assert.equal(icon.props.className.includes('animate-spin'),['uploading','processing'].includes(status));
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
