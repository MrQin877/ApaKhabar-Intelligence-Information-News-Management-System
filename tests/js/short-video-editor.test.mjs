import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('resources/js/pages/admin/short-videos.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const draft = { id:1, title:'Draft', description:'Description', video_url:'https://res.cloudinary.com/demo/video/upload/old.mp4', thumbnail_url:'/saved.jpg', frame_offset:2, metadata:{duration:20}, status:'draft' };
function mount() {
    const state = [], refs = [], requests = []; let index = 0, refIndex = 0, tree;
    const context = { exports:{}, FormData, document:{cookie:'',querySelector:()=>null}, XMLHttpRequest:class {
        upload = {}; status = 201;
        open() {} setRequestHeader() {}
        send(body) { requests.push(body); this.responseText=JSON.stringify({video:{...draft,id:2,video_url:'/new.mp4',thumbnail_url:'/new-cover.jpg',frame_offset:0}}); queueMicrotask(()=>this.onload()); }
    }, URL:{createObjectURL: file => `blob:${file.name}`, revokeObjectURL(){}}, window:{scrollTo(){}}, require(name) {
        if (name === 'react') return { useState(initial) { const i=index++; if (!(i in state)) state[i]=typeof initial==='function'?initial():initial; return [state[i], v => { state[i]=typeof v==='function'?v(state[i]):v; }]; }, useRef() { const i=refIndex++; return refs[i] ??= {current:null}; }, useEffect(){} };
        if (name === '@inertiajs/react') return {Head:'Head',router:{reload(){}},usePoll(){}};
        if (name === '@/hooks/use-unsaved-news') return {useUnsavedNews:()=>({open:false,requestLeave:fn=>fn(),allowLeave(){},leave(){},continueEditing(){}})};
        if (name === '@/lib/editor-snapshot') return {editorSnapshot:JSON.stringify};
        if (name === 'react/jsx-runtime') return require(name);
        return new Proxy({}, {get: (_, key)=>String(key)});
    }};
    vm.runInNewContext(compiled,context);
    const nodes = node => !node || typeof node !== 'object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
    const text = node => node == null?'':typeof node!=='object'?String(node):Array.isArray(node)?node.map(text).join(' '):text(node.props?.children);
    const render = () => {index=0;refIndex=0;tree=context.exports.ShortVideos({draft, videos:{data:[draft],current_page:1,last_page:1},publishPlatforms:[],metaAuth:{}});};
    render();
    return {render, requests, all:()=>nodes(tree), find:label=>nodes(tree).find(n=>text(n).trim()===label && ['Button','DropdownMenuItem'].includes(n.type)), input:id=>nodes(tree).find(n=>n.props?.id===id), text:()=>text(tree)};
}
test('editing a draft restores its thumbnail and Edit offers all three actions', () => {
    const v=mount(); v.render();
    assert.equal(v.all().find(n=>n.type==='img' && n.props.alt==='Sampul terpilih').props.src,'/saved.jpg');
    for (const label of ['Pilih Sampul dari Video','Unggah Sampul','Ganti Video']) assert.ok(v.find(label));
    const main=v.all().find(n=>n.type==='video' && n.props.controls);
    assert.equal(main.props.onSeeked,undefined, 'ordinary playback must not overwrite the selected cover');
    v.find('Pilih Sampul dari Video').props.onSelect(); v.render();
    assert.ok(v.all().some(n=>n.type==='Dialog' && n.props.open));
    v.input('frame-offset').props.onChange({target:{value:'4.5'}}); v.render();
    assert.equal(v.input('frame-offset').props.value,4.5);
});
test('custom cover previews immediately without opening a navigation warning', () => {
    const v=mount(); v.render();
    const cover=v.all().find(n=>n.type==='input' && n.props['aria-label']==='Unggah sampul');
    cover.props.onChange({target:{files:[{name:'cover.png',type:'image/png',size:100}],value:'cover.png'}}); v.render();
    assert.equal(v.all().find(n=>n.type==='img' && n.props.alt==='Sampul terpilih').props.src,'blob:cover.png');
    assert.equal(v.all().filter(n=>n.type==='Dialog' && n.props.open).length,0);
});
test('video replacement without an immediate navigation warning resets the old cover and frame and uses the new upload', async () => {
    const v=mount(); v.render();
    v.all().find(n=>n.type==='input' && n.props['aria-label']==='Unggah sampul').props.onChange({target:{files:[{name:'old-cover.png',type:'image/png',size:100}],value:''}}); v.render();
    const file=new File(['video'], 'replacement.mp4', {type:'video/mp4'});
    v.input('short-video').props.onChange({target:{files:[file],value:''}}); v.render();
    assert.equal(v.all().filter(n=>n.type==='Dialog' && n.props.open).length,0);
    await new Promise(resolve=>setImmediate(resolve)); v.render();
    assert.equal(v.requests.length,1);
    assert.equal(v.requests[0].get('video').name,'replacement.mp4');
    assert.equal(v.all().find(n=>n.type==='video' && n.props.controls).props.src,'blob:replacement.mp4');
    assert.equal(v.all().find(n=>n.type==='img' && n.props.alt==='Sampul terpilih').props.src,'/new-cover.jpg');
    assert.equal(v.input('frame-offset').props.value,0);
});
