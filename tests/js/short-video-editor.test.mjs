import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('resources/js/pages/admin/short-videos.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const draft = { id:1, title:'Draft', description:'Description', video_url:'https://res.cloudinary.com/demo/video/upload/old.mp4', thumbnail_url:'/saved.jpg', frame_offset:2, metadata:{duration:20}, status:'draft' };
function mount(initialDraft = draft) {
    const state = [], refs = [], requests = [], paths = [], apiRequests = []; let index = 0, refIndex = 0, tree, dirty = false;
    const context = { exports:{}, FormData, CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}}, document:{cookie:'',querySelector:()=>null}, XMLHttpRequest:class {
        upload = {}; status = 201;
        open(_method,path) {this.path=path;} setRequestHeader() {}
        send(body) { requests.push(body);paths.push(this.path); const uploaded={...draft,id:Number(body.get('short_video_id')??2),title:'',description:'',video_url:'/new.mp4',thumbnail_url:'/new-cover.jpg',frame_offset:0}; const video=this.path.endsWith('/upload')?uploaded:{...uploaded,id:Number(this.path.split('/').at(-1)),title:body.get('title'),description:body.get('description'),frame_offset:Number(body.get('frame_offset'))}; this.responseText=JSON.stringify({video}); queueMicrotask(()=>this.onload()); }
    }, URL:{createObjectURL: file => `blob:${file.name}`, revokeObjectURL(){}}, window:{scrollTo(){},dispatchEvent(){}}, require(name) {
        if (name === 'react') return { useState(initial) { const i=index++; if (!(i in state)) state[i]=typeof initial==='function'?initial():initial; return [state[i], v => { state[i]=typeof v==='function'?v(state[i]):v; }]; }, useRef() { const i=refIndex++; return refs[i] ??= {current:null}; }, useEffect(){} };
        if (name === '@inertiajs/react') return {Head:'Head',router:{reload(){}},usePoll(){}};
        if (name === '@/hooks/use-unsaved-news') return {useUnsavedNews:(isDirty)=>{dirty=isDirty;return{open:false,requestLeave:fn=>fn(),allowLeave(){},leave(){},continueEditing(){}}}};
        if (name === '@/lib/editor-snapshot') return {editorSnapshot:JSON.stringify};
        if (name === '@/lib/meta-auth') return {metaRequest:async (path,body)=>{apiRequests.push({path,body});return path.endsWith('/preview')?{token:'server-token'}:{video:{...draft,id:2,title:'New title',description:'Description',status:'published'},result:{pending:false,results:{}}};}};
        if (name === 'react/jsx-runtime') return require(name);
        return new Proxy({}, {get: (_, key)=>String(key)});
    }};
    vm.runInNewContext(compiled,context);
    const nodes = node => !node || typeof node !== 'object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
    const text = node => node == null?'':typeof node!=='object'?String(node):Array.isArray(node)?node.map(text).join(' '):text(node.props?.children);
    const render = () => {index=0;refIndex=0;tree=context.exports.ShortVideos({draft:initialDraft, videos:{data:initialDraft?[initialDraft]:[],current_page:1,last_page:1},publishPlatforms:[],metaAuth:{}});};
    render();
    return {render, requests, paths, apiRequests, get dirty(){return dirty;}, all:()=>nodes(tree), find:label=>nodes(tree).find(n=>text(n).trim().includes(label) && ['Button','DropdownMenuItem'].includes(n.type)), input:id=>nodes(tree).find(n=>n.props?.id===id), text:()=>text(tree)};
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
test('video replacement stays local and resets the old cover and frame', async () => {
    const v=mount(); v.render();
    v.all().find(n=>n.type==='input' && n.props['aria-label']==='Unggah sampul').props.onChange({target:{files:[{name:'old-cover.png',type:'image/png',size:100}],value:''}}); v.render();
    const file=new File(['video'], 'replacement.mp4', {type:'video/mp4'});
    v.input('short-video').props.onChange({target:{files:[file],value:''}}); v.render();
    assert.equal(v.all().filter(n=>n.type==='Dialog' && n.props.open).length,0);
    await new Promise(resolve=>setImmediate(resolve)); v.render();
    assert.equal(v.requests.length,0);
    assert.equal(v.all().find(n=>n.type==='video' && n.props.controls).props.src,'blob:replacement.mp4');
    assert.equal(v.all().find(n=>n.type==='img' && n.props.alt==='Sampul terpilih'),undefined);
    assert.equal(v.input('frame-offset').props.value,0);
});
test('local preview preserves entered fields and opens publishing without uploading', async () => {
    const v=mount(null);
    assert.equal(v.find('Publikasikan').props.disabled,true);
    v.input('short-title').props.onChange({target:{value:'Kegiatan Desa'}});
    v.input('short-description').props.onChange({target:{value:'Warga bergotong-royong.'}});
    v.render();
    assert.equal(v.find('Publikasikan').props.disabled,true);
    const file=new File(['video'],'new.mp4',{type:'video/mp4'});
    v.input('short-video').props.onChange({target:{files:[file],value:''}});
    v.render();
    assert.equal(v.requests.length,0);
    v.all().find(n=>n.type==='video' && n.props.controls).props.onLoadedMetadata({currentTarget:{duration:20}}); v.render();
    assert.equal(v.input('short-title').props.value,'Kegiatan Desa');
    assert.equal(v.input('short-description').props.value,'Warga bergotong-royong.');
    assert.equal(v.find('Publikasikan').props.disabled,false);
    assert.equal(v.all().find(n=>n.type==='FeedbackToast').props.feedback,null);
    v.find('Publikasikan').props.onClick(); v.render();
    const dialog=v.all().find(n=>n.type==='PublishNewsDialog');
    assert.equal(dialog.props.open,true);
    const preview=await dialog.props.onPreparePreview();
    assert.equal(preview.video_url,'blob:new.mp4');
    assert.equal(v.requests.length,0);
});
test('missing fields remain disabled with inline guidance; invalid video never reports success', () => {
    const v=mount(null);
    v.input('short-title').props.onBlur(); v.render();
    assert.match(v.text(),/Judul video wajib diisi/);
    v.input('short-video').props.onChange({target:{files:[new File(['bad'],'bad.txt',{type:'text/plain'})],value:''}});
    v.render();
    assert.equal(v.requests.length,0);
    assert.equal(v.find('Publikasikan').props.disabled,true);
    assert.equal(v.all().find(n=>n.type==='FeedbackToast').props.feedback.variant,'error');
});
test('explicit Save Draft uploads once then saves metadata and clears dirty state', async () => {
    const v=mount(null);
    assert.equal(v.dirty,false);
    v.input('short-video').props.onChange({target:{files:[new File(['video'],'new.mp4',{type:'video/mp4'})],value:''}});
    v.render();
    assert.equal(v.dirty,true);
    assert.equal(v.requests.length,0);
    v.input('short-title').props.onChange({target:{value:'New title'}});
    v.input('short-description').props.onChange({target:{value:'Description'}}); v.render();
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve=>setImmediate(resolve)); v.render();
    assert.deepEqual(v.paths,['/admin/short-videos/upload','/admin/short-videos/2']);
    assert.equal(v.requests[0].get('video').name,'new.mp4');
    assert.equal(v.requests[1].get('title'),'New title');
    assert.equal(v.dirty,false);
});
test('final Publish confirmation uploads once, saves, previews on server and publishes', async () => {
    const v=mount(null);
    v.input('short-title').props.onChange({target:{value:'New title'}});
    v.input('short-description').props.onChange({target:{value:'Description'}});
    v.input('short-video').props.onChange({target:{files:[new File(['video'],'new.mp4',{type:'video/mp4'})],value:''}});
    v.render();
    v.all().find(n=>n.type==='video' && n.props.controls).props.onLoadedMetadata({currentTarget:{duration:20}});v.render();
    v.find('Publikasikan').props.onClick();v.render();
    const dialog=v.all().find(n=>n.type==='PublishNewsDialog');
    await dialog.props.onPreparePreview();
    assert.equal(v.requests.length,0);
    dialog.props.onOpenChange(false);v.render();
    assert.equal(v.requests.length,0,'cancelling must not upload');
    v.find('Publikasikan').props.onClick();v.render();
    v.all().find(n=>n.type==='PublishNewsDialog').props.onPublish('local-preview');
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.deepEqual(v.paths,['/admin/short-videos/upload','/admin/short-videos/2']);
    assert.deepEqual(v.apiRequests.map(x=>x.path),['/admin/short-videos/2/preview','/admin/short-videos/2/publish']);
    assert.equal(v.apiRequests[1].body.preview_token,'server-token');
});
test('saving an unchanged draft does not upload its video again', async () => {
    const v=mount();
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.deepEqual(v.paths,['/admin/short-videos/1']);
});
test('saving a replacement reuses the same draft record', async () => {
    const v=mount();
    v.input('short-video').props.onChange({target:{files:[new File(['video'],'replacement.mp4',{type:'video/mp4'})],value:''}});v.render();
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.equal(v.requests[0].get('short_video_id'),'1');
    assert.deepEqual(v.paths,['/admin/short-videos/upload','/admin/short-videos/1']);
});
test('local custom thumbnail is uploaded only when saving the draft', async () => {
    const v=mount(null);
    v.input('short-video').props.onChange({target:{files:[new File(['video'],'new.mp4',{type:'video/mp4'})],value:''}});v.render();
    v.input('short-title').props.onChange({target:{value:'New title'}});
    v.input('short-description').props.onChange({target:{value:'Description'}});
    v.all().find(n=>n.type==='input' && n.props['aria-label']==='Unggah sampul').props.onChange({target:{files:[new File(['image'],'cover.png',{type:'image/png'})],value:''}});v.render();
    assert.equal(v.requests.length,0);
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.equal(v.requests[1].get('cover_mode'),'upload');
    assert.equal(v.requests[1].get('cover').name,'cover.png');
});
test('selected local frame offset is persisted after the explicit upload', async () => {
    const v=mount(null);
    v.input('short-video').props.onChange({target:{files:[new File(['video'],'new.mp4',{type:'video/mp4'})],value:''}});v.render();
    v.input('short-title').props.onChange({target:{value:'New title'}});
    v.input('short-description').props.onChange({target:{value:'Description'}});
    v.input('frame-offset').props.onChange({target:{value:'4.5'}});v.render();
    assert.equal(v.requests.length,0);
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.equal(v.requests[1].get('cover_mode'),'frame');
    assert.equal(v.requests[1].get('frame_offset'),'4.5');
});
