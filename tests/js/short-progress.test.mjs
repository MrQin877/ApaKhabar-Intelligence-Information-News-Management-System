import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('resources/js/components/short-publication-panel.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const words = node => node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(words).join(' ') : words(node.props?.children);
const videoResult = (instagram='processing') => ({attempt_id:'short-7',pending:instagram==='processing',results:{website:{status:'published',success:true},instagram:{status:instagram,success:instagram==='published'},facebook:{status:'not_selected'}}});
const newsResult = (instagram=true) => ({attempt_id:'news-7',success:instagram,completion_url:'/admin/news',results:{application:{success:true},instagram:{success:instagram}}});
function panel(storage = new Map()) {
    const slots=[], effects=[], events=new Map(), intervals=new Map(), timeouts=new Map(), requests=[];
    let cursor=0, serial=0, response={result:videoResult(),video:{thumbnail_url:'/video.jpg'}};
    const context={exports:{},sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},window:{
        addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),
        setInterval:fn=>{const id=++serial;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
        setTimeout:(fn,ms)=>{const id=++serial;timeouts.set(id,{fn,ms});return id;},clearTimeout:id=>timeouts.delete(id),
    },require(name){
        if(name==='react')return{useState(init){const id=cursor++;if(!(id in slots))slots[id]=typeof init==='function'?init():init;return[slots[id],value=>{slots[id]=typeof value==='function'?value(slots[id]):value;}];},useRef(init){const id=cursor++;return slots[id]??={current:init};},useEffect(fn,deps){const id=cursor++;const prior=slots[id];if(!prior||deps.some((v,i)=>v!==prior.deps[i]))effects.push(()=>{prior?.cleanup?.();slots[id]={deps,cleanup:fn()};});}};
        if(name==='@inertiajs/react')return{usePage:()=>({props:{auth:{user:{id:42}}}}),Link:'Link'};
        if(name==='@/lib/short-publication')return{publicationPolling:result=>!result||result.pending===true||result.permalink_pending===true};
        if(name==='@/lib/meta-auth')return{metaRequest:async(...args)=>{requests.push(args);return response;}};
        if(name==='react/jsx-runtime')return require(name);
        return new Proxy({},{get:(_,key)=>String(key)});
    }};
    vm.runInNewContext(compiled,context);
    const render=()=>{cursor=0;const tree=context.exports.ShortPublicationPanel();effects.splice(0).forEach(fn=>fn());return nodes(tree);};
    render();
    return{render,storage,requests,timeouts,receive:(kind,detail)=>events.get(kind==='video'?'short-publication':'news-publication')({detail}),tick:async()=>{[...intervals.values()].forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));},advance:ms=>{[...timeouts].filter(([,t])=>t.ms<=ms).forEach(([id,t])=>{timeouts.delete(id);t.fn();});},response:value=>{response=value;}};
}

test('news and video share one panel with independent actual platform counts and detail dialogs',async()=>{
    const app=panel();
    app.receive('news',{id:'n1',title:'Kegiatan Desa',thumbnail_url:'/news.jpg',destinations:['website','instagram'],ready:false});
    app.receive('video',{id:7,title:'Festival Desa',destinations:['website','instagram'],ready:true,result:videoResult()});
    let view=app.render();assert.equal(view.filter(n=>n.type==='aside').length,1);
    assert.match(words(view),/Berita\s*:\s*Kegiatan Desa/);assert.match(words(view),/Video Pendek\s*:\s*Festival Desa/);
    assert.deepEqual(view.filter(n=>n.props?.role==='progressbar').map(n=>n.props['aria-valuenow']),[0,1]);
    app.receive('news',{id:'n1',title:'Kegiatan Desa',thumbnail_url:'/news.jpg',destinations:['website','instagram'],ready:true,result:newsResult(false)});
    view=app.render();assert.deepEqual(view.filter(n=>n.props?.role==='progressbar').map(n=>n.props['aria-valuenow']),[1,2]);
    view.filter(n=>n.type==='Button'&&n.props.children==='Lihat Detail')[1].props.onClick();
    view=app.render();assert.equal(view.find(n=>n.type==='PublishResultDialog').props.videoMode,false);
    view.find(n=>n.type==='PublishResultDialog').props.onDismiss();
    view=app.render();view.filter(n=>n.type==='Button'&&n.props.children==='Lihat Detail')[0].props.onClick();
    assert.equal(app.render().find(n=>n.type==='PublishResultDialog').props.videoMode,true);
    await app.tick();assert.ok(app.requests.every(([url])=>url==='/admin/short-videos/7/status'));
});

test('navigation restores jobs, minimize works, success clears after five seconds while failures remain',()=>{
    const storage=new Map();const app=panel(storage);
    app.receive('news',{id:'n1',title:'Berita',destinations:['website'],ready:true,result:newsResult()});
    app.receive('video',{id:7,title:'Video',destinations:['website','instagram'],ready:true,result:videoResult('failed')});
    let view=app.render();view.find(n=>n.props?.['aria-label']==='Minimalkan status publikasi').props.onClick();
    view=app.render();assert.equal(view.filter(n=>n.props?.role==='progressbar').length,0);
    const reopened=panel(storage);view=reopened.render();assert.match(words(view),/Berita\s*:\s*Berita/);assert.match(words(view),/Video Pendek\s*:\s*Video/);
    reopened.advance(5000);view=reopened.render();assert.doesNotMatch(words(view),/Berita\s*:\s*Berita/);assert.match(words(view),/Video Pendek\s*:\s*Video/);
    view.find(n=>n.props?.['aria-label']==='Tutup status Video').props.onClick();assert.equal(reopened.render().length,0);
});

test('video polling updates only its own job and never uploads or retries automatically',async()=>{
    const app=panel();app.receive('news',{id:'7',title:'News',destinations:['website'],ready:true,result:newsResult()});
    app.receive('video',{id:7,title:'Video',destinations:['website','instagram'],ready:true,result:videoResult()});
    app.render();app.response({result:videoResult('published'),video:{thumbnail_url:'/video.jpg'}});await app.tick();
    const view=app.render();assert.deepEqual(view.filter(n=>n.props?.role==='progressbar').map(n=>n.props['aria-valuenow']),[1,2]);
    assert.ok(app.requests.every(([url])=>url==='/admin/short-videos/7/status'));
});

test('news-only and video-only jobs expose their own destination counts',()=>{
    const news=panel();news.receive('news',{id:'n',title:'Berita saja',destinations:['website','facebook'],ready:true,result:{attempt_id:'n',success:false,results:{application:{success:true},facebook:{success:false}}}});
    let view=news.render();assert.equal(view.filter(n=>n.props?.role==='progressbar')[0].props['aria-valuenow'],2);
    assert.match(words(view),/Berita\s*:\s*Berita saja/);
    const video=panel();video.receive('video',{id:11,title:'Video saja',destinations:['website','instagram'],ready:true,result:videoResult()});
    view=video.render();assert.equal(view.filter(n=>n.props?.role==='progressbar')[0].props['aria-valuenow'],1);
    assert.match(words(view),/Video Pendek\s*:\s*Video saja/);
});

test('news and video detail dialogs retain separate titles and listing actions',()=>{
    const code=ts.transpileModule(readFileSync('resources/js/components/publish-result-dialog.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const visits=[];
    const context={exports:{},require(name){
        if(name==='react')return{useState:initial=>[initial,()=>{}]};
        if(name==='@inertiajs/react')return{usePage:()=>({props:{}}),router:{visit:path=>visits.push(path)}};
        if(name==='@/lib/short-publication')return{publicationUrl:()=>null};
        if(name==='react/jsx-runtime')return require(name);
        return new Proxy({},{get:(_,key)=>String(key)});
    }};
    vm.runInNewContext(code,context);
    const news=nodes(context.exports.PublishResultDialog({result:newsResult()}));
    assert.ok(news.some(n=>n.type==='DialogTitle'&&words(n).includes('Status Publikasi Berita')));
    news.find(n=>n.type==='Button'&&n.props.children==='Daftar Berita').props.onClick();
    const video=nodes(context.exports.PublishResultDialog({videoMode:true,result:videoResult('published')}));
    assert.ok(video.some(n=>n.type==='DialogTitle'&&words(n).includes('Status Publikasi Video')));
    video.find(n=>n.type==='Button'&&n.props.children==='Daftar Video').props.onClick();
    assert.deepEqual(visits,['/admin/news','/admin/short-videos']);
});
