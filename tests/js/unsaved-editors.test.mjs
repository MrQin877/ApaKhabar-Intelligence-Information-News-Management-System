import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
function compile(path) {return ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;}
const hookCode=compile('resources/js/hooks/use-unsaved-news.ts');
function mount() {
 const slots=[], effects=[], events=new Map(), browser=new Map(), dom=new Map(); let index=0, current, historyGuard, dirty=false, busy=false, visits=0;
 const location={href:'https://test/admin/editor',origin:'https://test',pathname:'/admin/editor',search:'',assign(){visits++;}};
 const router={on(name,cb){events.set(name,cb);return()=>events.delete(name);},visit(url,options){visits++;assert.equal(before(url,options).prevented,false);}};
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=v];},useRef(initial){const i=index++;return slots[i]??=( {current:initial} );},useCallback(fn){index++;return fn;},useEffect(fn,deps){const i=index++;const old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}}};
 const context={exports:{},URL,location,Element:class{},window:{addEventListener:(n,f)=>browser.set(n,f),removeEventListener:n=>browser.delete(n)},document:{addEventListener:(n,f)=>dom.set(n,f),removeEventListener:n=>dom.delete(n)},require(name){if(name==='react')return react;if(name==='@inertiajs/react')return{router};return{setNavigationGuard(g){historyGuard=g;return()=>{historyGuard=null;};}};}};
 vm.runInNewContext(hookCode,context);
 function render(d=dirty,b=busy){dirty=d;busy=b;index=0;current=context.exports.useUnsavedNews(dirty,busy);effects.splice(0).forEach(f=>f());return current;}
 function before(url='https://test/other',extra={}){const e={detail:{visit:{url:new URL(url),...extra}},prevented:false,preventDefault(){this.prevented=true;}};events.get('before')?.(e);return e;}
 render();return{render,before,get hook(){return current;},get visits(){return visits;},get guard(){return historyGuard;},finish:()=>events.get('finish')?.(),unload(){const e={prevented:false,preventDefault(){this.prevented=true;}};browser.get('beforeunload')?.(e);return e;},cleanup(){slots.forEach(s=>s?.cleanup?.());assert.equal(events.size,0);assert.equal(browser.size,0);assert.equal(dom.size,0);}};
}
test('untouched editor and same-page polling never prompt; only a dirty exit does',()=>{
 const m=mount();assert.equal(m.before().prevented,false);m.render(true);
 assert.equal(m.before('https://test/admin/editor').prevented,false);
 assert.equal(m.before('https://test/admin/editor?page=2',{preserveState:true,only:['videos']}).prevented,false);
 assert.equal(m.render().open,false);
 assert.equal(m.before().prevented,true);assert.equal(m.render().open,true);m.cleanup();
});
test('cancel preserves dirty state and the first destination survives repeated exit attempts',()=>{
 const m=mount();m.render(true);m.before();m.before('https://test/third');m.render();m.hook.continueEditing();assert.equal(m.render().open,false);assert.equal(m.unload().prevented,true);
 m.before();m.render();m.hook.leave();assert.equal(m.visits,1);assert.equal(m.render().open,false);m.finish();assert.equal(m.before().prevented,true);m.cleanup();
});
test('successful save clears protection while a failed save leaves the prompt and edits intact',()=>{
 const m=mount();m.render(true);m.before();m.render(true,true);m.hook.continueEditing();assert.equal(m.render(true,false).open,true);
 // Failed save does not call leave or change the baseline.
 assert.equal(m.visits,0);assert.equal(m.unload().prevented,true);
 m.render(false);m.hook.leave();assert.equal(m.visits,1);m.finish();assert.equal(m.before().prevented,false);m.cleanup();
});
test('saving then editing again restores protection; native unload is dirty-only',()=>{
 const m=mount();assert.equal(m.unload().prevented,false);m.render(true);assert.equal(m.unload().prevented,true);
 m.hook.allowLeave();m.render(false);assert.equal(m.unload().prevented,false);m.render(true);assert.equal(m.before().prevented,true);m.cleanup();
});
const snap={exports:{},File};vm.runInNewContext(compile('resources/js/lib/editor-snapshot.ts'),snap);
test('manual baseline excludes destinations and normalizes empty editor HTML; reverting restores clean state',()=>{
 const data={headline:'',content:'',category_id:'',image:'',image_crops:null,cover_photo:null,show_on_homepage:true,content_format:'html',platforms:['website']};
 const baseline=snap.exports.manualSnapshot(data);
 assert.equal(snap.exports.manualSnapshot({...data,content:'<p><br></p>',platforms:['instagram']}),baseline);
 assert.notEqual(snap.exports.manualSnapshot({...data,headline:'Changed'}),baseline);
 assert.equal(snap.exports.manualSnapshot({...data,headline:''}),baseline);
 assert.notEqual(snap.exports.manualSnapshot({...data,show_on_homepage:false}),baseline);
});
test('snapshot compares persisted structures regardless of key order and detects different media files',()=>{
 assert.equal(snap.exports.editorSnapshot({a:1,b:{x:2,y:3}}),snap.exports.editorSnapshot({b:{y:3,x:2},a:1}));
 const first=new File(['a'],'cover.png'), second=new File(['b'],'cover.png');
 assert.equal(snap.exports.editorSnapshot({cover:first}),snap.exports.editorSnapshot({cover:first}));
 assert.notEqual(snap.exports.editorSnapshot({cover:first}),snap.exports.editorSnapshot({cover:second}));
});
test('Back and Forward restore the editor before asking and resume exactly once without history loops',()=>{
 const listeners=[];let index=0,stopped=0,asked=0,pending,dirty=true;
 const entries=[{url:'https://test/list',state:null}];
 const win={location:{href:entries[0].url},addEventListener(name,fn){if(name==='popstate')listeners.push(fn);}};
 win.history={get state(){return entries[index].state;},replaceState(state,unused,url){entries[index]={state,url:url?new URL(url,win.location.href).href:win.location.href};win.location.href=entries[index].url;},pushState(state,unused,url){entries.splice(index+1);entries.push({state,url:new URL(url,win.location.href).href});index++;win.location.href=entries[index].url;},go(delta){index+=delta;assert.ok(index>=0&&index<entries.length);win.location.href=entries[index].url;const e={state:entries[index].state,stopImmediatePropagation(){stopped++;}};listeners.forEach(fn=>fn(e));}};
 const context={exports:{},URL,WeakSet};vm.runInNewContext(compile('resources/js/lib/navigation-guard.ts'),context);
 context.exports.installNavigationGuard(win);context.exports.installNavigationGuard(win);assert.equal(listeners.length,1);
 win.history.pushState({},'', '/editor');
 context.exports.setNavigationGuard({blocked:()=>dirty,ask:fn=>{asked++;pending=fn;}});
 win.history.go(-1);assert.equal(win.location.href,'https://test/editor');assert.equal(asked,1);
 // Cancel stays on the editor; another Back can be approved.
 pending=null;win.history.go(-1);assert.equal(asked,2);dirty=false;pending();assert.equal(win.location.href,'https://test/list');
 win.history.go(1);assert.equal(win.location.href,'https://test/editor');
 win.history.pushState({},'', '/other');win.history.go(-1);dirty=true;
 win.history.go(1);assert.equal(win.location.href,'https://test/editor');assert.equal(asked,3);
 dirty=false;pending();assert.equal(win.location.href,'https://test/other');assert.equal(stopped,6);
});
