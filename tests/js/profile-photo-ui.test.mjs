import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const lib = {};
vm.runInNewContext(compile('../../resources/js/lib/profile-photo.ts'), { exports: lib, Error });
const code = compile('../../resources/js/components/profile-photo.tsx');
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props?.children)] : [];
const tick = () => new Promise(resolve => setImmediate(resolve));
function mount() {
    const slots = []; let cursor = 0, mode = 'ok', calls = 0, reloads = 0, draws = 0;
    const effects = [], exports = {};
    const canvas = { getContext: () => ({ fillRect(){}, drawImage(){ draws++; } }), toBlob: callback => callback(new Blob(['cropped'], { type: 'image/jpeg' })) };
    const react = {
        useState(initial){ const i=cursor++; if (!(i in slots)) slots[i]=initial; return [slots[i], value => slots[i]=typeof value==='function'?value(slots[i]):value]; },
        useRef(initial){ const i=cursor++; return slots[i]??={current:initial}; },
        useEffect(callback,deps){const i=cursor++;const old=slots[i];if(!old||deps.some((value,index)=>value!==old[index])){slots[i]=deps;effects.push(callback);}},
    };
    const jsx = (type, props) => { if (type === 'canvas') props.ref.current=canvas; return { type, props }; };
    vm.runInNewContext(code, { exports, Error, Blob, Image: class { naturalWidth=1200; naturalHeight=800; async decode(){ if(mode==='corrupt') throw new Error('broken'); } }, URL: { createObjectURL:()=> 'blob:photo', revokeObjectURL(){} }, require(name){
        if(name==='react') return react;
        if(name==='react/jsx-runtime') return {jsx,jsxs:jsx};
        if(name==='@inertiajs/react') return {router:{reload(){reloads++;}}};
        if(name==='@/lib/profile-photo') return {...lib, async mutatePhoto(blob){ calls++; if(mode==='fail') throw new Error('Network failed'); return {avatar:blob?'new.jpg':null}; }};
        return new Proxy({}, {get:(_,key)=>String(key)});
    }});
    function render(){ cursor=0;effects.length=0;const tree=nodes(exports.default({user:{name:'Aina',avatar:'old.jpg'}}));effects.forEach(effect=>effect());return tree; }
    const pick = file => { render().find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:file?[file]:[],value:'selected'}}); };
    return {render,pick,setMode(value){mode=value;},get calls(){return calls;},get reloads(){return reloads;},get draws(){return draws;}};
}
const photo = {type:'image/jpeg',size:1000};
test('validation rejects unsupported empty oversized files; square crop stays within bounds',()=>{
    for(const file of [{type:'image/svg+xml',size:1},{type:'image/png',size:0},{type:'image/jpeg',size:5242881}]) assert.throws(()=>lib.validatePhoto(file));
    lib.validatePhoto(photo);
    for(const [w,h] of [[1200,800],[800,1200],[512,512]]) for(const zoom of [1,2,3]) {
        const crop=lib.cropArea(w,h,zoom,-1,2);assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.size<=w&&crop.y+crop.size<=h);
    }
});
test('cancel and corrupt selection preserve avatar; save failure retains crop and successful save refreshes shared data',async()=>{
    const app=mount();app.pick();assert.equal(app.render().find(n=>n.type==='Dialog').props.open,false);
    app.setMode('corrupt');app.pick(photo);await tick();assert.equal(app.render().find(n=>n.type==='Dialog').props.open,false);assert.equal(app.render().find(n=>n.type==='FeedbackToast').props.feedback.variant,'error');
    app.setMode('ok');app.pick(photo);await tick();let tree=app.render();assert.equal(tree.find(n=>n.type==='Dialog').props.open,true);assert.ok(app.draws>0);
    const zoom=tree.find(n=>n.type==='input'&&n.props.type==='range');zoom.props.onChange({target:{value:'2'}});assert.equal(app.render().find(n=>n.type==='input'&&n.props.type==='range').props.value,2);
    app.setMode('fail');app.render().find(n=>n.type==='Button'&&n.props.children[1]==='Simpan').props.onClick();await tick();tree=app.render();assert.equal(tree.find(n=>n.type==='Dialog').props.open,true);assert.ok(tree.some(n=>n.props.role==='alert'&&n.props.children==='Network failed'));
    app.setMode('ok');const save=tree.find(n=>n.type==='Button'&&n.props.children[1]==='Simpan');save.props.onClick();save.props.onClick();await tick();tree=app.render();assert.equal(app.calls,2);assert.equal(app.reloads,1);assert.equal(tree.find(n=>n.type==='Dialog').props.open,false);assert.equal(tree.find(n=>n.type==='AvatarImage').props.src,'new.jpg');assert.equal(tree.find(n=>n.type==='FeedbackToast').props.duration,5000);
});
test('removal saves immediately and restores initial avatar fallback',async()=>{
    const app=mount();app.render().find(n=>n.type==='Button'&&n.props.children[1]==='Buang foto').props.onClick();await tick();const tree=app.render();assert.equal(app.calls,1);assert.equal(tree.find(n=>n.type==='AvatarImage').props.src,undefined);assert.equal(tree.find(n=>n.type==='AvatarFallback').props.children,'A');
});
