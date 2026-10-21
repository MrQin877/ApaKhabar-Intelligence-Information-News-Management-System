import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';
const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync('resources/js/components/short-publication-panel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
test('floating publication tracking survives page remount and refresh using only tab-scoped metadata',()=>{
 const storage=new Map();
 function mount() {
  const states=[],callbacks=new Map();let cursor=0;
  const context={exports:{},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},window:{addEventListener:(n,f)=>callbacks.set(n,f),removeEventListener:n=>callbacks.delete(n),setInterval:()=>1,clearInterval(){}},require(name){
   if(name==='@/lib/short-publication')return{publicationActive:r=>!r||Object.values(r.results).some(v=>['queued','processing','uploading'].includes(v.status))};
   if(name==='react')return{useRef:initial=>({current:initial}),useState(init){const i=cursor++;if(!(i in states))states[i]=typeof init==='function'?init():init;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useEffect(fn){fn();}};
   if(name==='@inertiajs/react')return{usePage:()=>({props:{auth:{user:{id:42}}}}),Link:'Link'};
   if(name==='@/lib/meta-auth')return{metaRequest:async()=>({result:{results:{website:{status:'published'}}}})};
   if(name==='react/jsx-runtime')return require(name);
   return new Proxy({},{get:(_,key)=>String(key)});
  }};
  vm.runInNewContext(code,context);
  const render=()=>{cursor=0;return context.exports.ShortPublicationPanel();};render();return{render,receive:detail=>callbacks.get('short-publication')({detail})};
 }
 const first=mount();first.receive({id:7,title:'Video'});first.render();
 assert.deepEqual(JSON.parse(storage.get('short-publications:42')),[{id:7,title:'Video'}]);
 const second=mount();assert.ok(second.render());
});
