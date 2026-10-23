import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('resources/js/pages/admin/short-videos.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const draft = { id:1, title:'Draft', description:'Description', video_url:'https://res.cloudinary.com/demo/video/upload/old.mp4', thumbnail_url:'/saved.jpg', frame_offset:2, metadata:{duration:20}, status:'draft' };
function mount(initialDraft = draft, options = {}) {
    const effects=[], pendingEffects=[], timers=new Map(); let effectIndex=0, timerId=0;
    const state = [], refs = [], requests = [], paths = [], apiRequests = [], visits = [], visitOptions = [], events = []; let index = 0, refIndex = 0, tree, dirty = false;
    const context = { exports:{}, FormData, setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},fetch:async()=>({ok:true,json:async()=>({video:options.latest})}), CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}}, document:{cookie:'',querySelector:()=>null}, XMLHttpRequest:class {
        upload = {}; status = 201;
        open(_method,path) {this.path=path;} setRequestHeader() {}
        send(body) { requests.push(body);paths.push(this.path); const uploaded={...draft,metadata:{duration:20,cover_source:'frame'},id:Number(body.get('short_video_id')??2),title:'',description:'',video_url:'/new.mp4',thumbnail_url:'/new-cover.jpg',frame_offset:0}; const video=this.path.endsWith('/crop')?{...draft,video_url:'/cropped.mp4',thumbnail_url:'/cropped-cover.jpg',metadata:{duration:12,video_crop:{x:0.5,y:0.5,zoom:1,start:0,end:12},crop_source:{url:'/new.mp4'}}}:this.path.endsWith('/upload')?uploaded:{...uploaded,id:Number(this.path.split('/').at(-1)),title:body.get('title'),description:body.get('description'),frame_offset:Number(body.get('frame_offset'))}; this.responseText=JSON.stringify({video:options.respond?.(this.path,body)??video}); if(options.progress)this.upload.onprogress?.({lengthComputable:true,loaded:1,total:2}); queueMicrotask(()=>this.onload()); }
    }, URL:{createObjectURL: file => `blob:${file.name}`, revokeObjectURL(){}}, window:{scrollTo(){},dispatchEvent(event){events.push(event)}}, require(name) {
        if (name === 'react') return { useState(initial) { const i=index++; if (!(i in state)) state[i]=typeof initial==='function'?initial():initial; return [state[i], v => { state[i]=typeof v==='function'?v(state[i]):v; }]; }, useRef() { const i=refIndex++; return refs[i] ??= {current:null}; }, useEffect(fn,deps){if(!options.effects)return;const i=effectIndex++;const old=effects[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){old?.cleanup?.();pendingEffects.push(()=>{effects[i]={deps,cleanup:fn()};});}} };
        if (name === '@inertiajs/react') return {Head:'Head',router:{reload(){},replace(){},visit(path, options){visits.push(path);visitOptions.push(options)}},usePoll(){}};
        if (name === '@/hooks/use-unsaved-news') return {useUnsavedNews:(isDirty)=>{dirty=isDirty;return{open:false,requestLeave:fn=>fn(),allowLeave(){},leave(){},continueEditing(){}}}};
        if (name === '@/lib/editor-snapshot') return {editorSnapshot:JSON.stringify};
        if (name === '@/lib/meta-auth') return {metaRequest:async (path,body)=>{apiRequests.push({path,body});return path.endsWith('/preview')?{token:'server-token'}:{video:{...draft,id:2,title:'New title',description:'Description',status:'published'},result:{pending:false,results:{}}};}};
        if (name === '@/components/video-frame-timeline') return {VideoFrameTimeline:'VideoFrameTimeline',formatFrameTime:t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(1).padStart(4,'0')}`};
        if (name === '@/components/short-cover-dialog') return {CoverPreview:'CoverPreview',ShortCoverDialog:'ShortCoverDialog',defaultCoverCrop:{mode:'fit',x:0.5,y:0.5,zoom:1},coverPoster:async(source)=>source};
        if (name === 'react/jsx-runtime') return require(name);
        return new Proxy({}, {get: (_, key)=>String(key)});
    }};
    vm.runInNewContext(compiled,context);
    const nodes = node => !node || typeof node !== 'object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
    const text = node => node == null?'':typeof node!=='object'?String(node):Array.isArray(node)?node.map(text).join(' '):text(node.props?.children);
    const render = () => {index=0;refIndex=0;effectIndex=0;tree=context.exports.ShortVideos({draft:initialDraft, videos:{data:initialDraft?[initialDraft]:[],current_page:1,last_page:1},publishPlatforms:[],metaAuth:{}});while(pendingEffects.length)pendingEffects.shift()();};
    render();
    return {render, tick:async()=>{const entry=timers.entries().next().value;if(entry){timers.delete(entry[0]);await entry[1]();}},timerCount:()=>timers.size, requests, paths, apiRequests, visits, visitOptions, events, get dirty(){return dirty;}, all:()=>nodes(tree), find:label=>nodes(tree).find(n=>text(n).trim().includes(label) && ['Button','DropdownMenuItem'].includes(n.type)), input:id=>nodes(tree).find(n=>n.props?.id===id), text:()=>text(tree)};
}
test('editing a draft restores its thumbnail and Edit offers only crop and replacement actions', () => {
    const v=mount(); v.render();
    assert.equal(v.all().find(n=>n.type==='CoverPreview').props.source,'/saved.jpg');
    for (const label of ['Sesuaikan / Pangkas Video','Ganti Video']) assert.ok(v.find(label));
    const main=v.all().find(n=>n.type==='video' && n.props.controls);
    assert.equal(main.props.onSeeked,undefined, 'ordinary playback must not overwrite the selected cover');
    assert.equal(v.find('Pilih Sampul'), undefined);
    v.all().find(n => n.type === 'Tabs').props.onValueChange('video'); v.render();
    v.all().find(n => n.type === 'VideoFrameTimeline').props.onSelect(4.5); v.render();
    assert.equal(v.all().find(n => n.type === 'VideoFrameTimeline').props.offset,4.5);
});
test('custom cover previews immediately without opening a navigation warning', () => {
    const v=mount(); v.render();
    const cover=v.all().find(n=>n.type==='input' && n.props['aria-label']==='Unggah sampul');
    cover.props.onChange({target:{files:[{name:'cover.png',type:'image/png',size:100}],value:'cover.png'}}); v.render();
    assert.equal(v.all().find(n=>n.type==='CoverPreview').props.source,'blob:cover.png');
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
    assert.equal(v.all().find(n=>n.type==='CoverPreview'),undefined);
    assert.equal(v.all().find(n => n.type === 'VideoFrameTimeline').props.offset,0);
});
test('new local media preserves fields and requires saving before publishing', () => {
    const v=mount(null);
    v.input('short-title').props.onChange({target:{value:'Kegiatan Desa'}});
    v.input('short-description').props.onChange({target:{value:'Warga bergotong-royong.'}});
    v.render();
    const file=new File(['video'],'new.mp4',{type:'video/mp4'});
    v.input('short-video').props.onChange({target:{files:[file],value:''}});
    v.render();
    v.all().find(n=>n.type==='video' && n.props.controls).props.onLoadedMetadata({currentTarget:{duration:20}}); v.render();
    assert.equal(v.input('short-title').props.value,'Kegiatan Desa');
    assert.equal(v.input('short-description').props.value,'Warga bergotong-royong.');
    assert.equal(v.find('Publikasikan').props.disabled,true);
    assert.equal(v.find('Simpan Draf').props.disabled,false);
    assert.match(v.text(),/Simpan draf terlebih dahulu/);
    assert.equal(v.requests.length,0);
});
test('missing publication fields do not block drafts; invalid video never reports success', () => {
    const v=mount(null);
    v.input('short-title').props.onBlur(); v.render();
    assert.doesNotMatch(v.text(),/Judul video wajib diisi/);
    v.input('short-video').props.onChange({target:{files:[new File(['bad'],'bad.txt',{type:'text/plain'})],value:''}});
    v.render();
    assert.equal(v.requests.length,0);
    assert.equal(v.find('Publikasikan').props.disabled,true);
    assert.equal(v.all().find(n=>n.type==='FeedbackToast').props.feedback.variant,'error');
});
test('an existing draft saves empty title and description to the same ID', async () => {
    const v=mount();
    v.input('short-title').props.onChange({target:{value:''}});
    v.input('short-description').props.onChange({target:{value:''}});
    v.render();
    assert.equal(v.find('Publikasikan').props.disabled,true);
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve=>setImmediate(resolve)); v.render();
    assert.equal(v.paths.at(-1),'/admin/short-videos/1');
    assert.equal(v.requests.at(-1).get('title'),'');
    assert.equal(v.requests.at(-1).get('description'),'');
    assert.equal(v.all().find(n=>n.type==='FeedbackToast').props.feedback.message,'Draf berhasil disimpan');
    assert.equal(v.visits.length,0);
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
    assert.deepEqual(v.paths,[]);
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
    v.all().find(n => n.type === 'Tabs').props.onValueChange('photo'); v.render();
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
    v.all().find(n => n.type === 'VideoFrameTimeline').props.onSelect(4.5);v.render();
    assert.equal(v.requests.length,0);
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.equal(v.requests[1].get('cover_mode'),'frame');
    assert.equal(v.requests[1].get('frame_offset'),'4.5');
});


test('crop editor reopens the preserved original and cancelling performs no requests', () => {
    const crop = { x: 0.2, y: 0.5, zoom: 2, start: 1, end: 10 };
    const v = mount({ ...draft, metadata: { duration: 9, crop_source: { url: '/original.mp4' }, video_crop: crop } });
    v.find('Sesuaikan / Pangkas Video').props.onSelect();
    v.render();
    const dialog = v.all().find(n => n.type === 'VideoCropDialog');
    assert.equal(dialog.props.source, '/original.mp4');
    assert.equal(dialog.props.initial, crop);
    dialog.props.onClose();
    v.render();
    assert.equal(v.all().some(n => n.type === 'VideoCropDialog'), false);
    assert.equal(v.requests.length, 0);
});


test('landscape defaults to Fit and does not require a crop confirmation to save', async () => {
    const v = mount();
    v.input('short-video').props.onChange({ target: { files: [new File(['video'], 'wide.mp4', { type: 'video/mp4' })], value: '' } }); v.render();
    v.all().find(n => n.type === 'video' && n.props.controls).props.onLoadedMetadata({ currentTarget: { videoWidth: 1920, videoHeight: 1080, duration: 12 } }); v.render();
    assert.equal(v.all().some(n => n.type === 'VideoCropDialog'), false);
    v.find('Sesuaikan / Pangkas Video').props.onSelect(); v.render();
    v.all().find(n => n.type === 'VideoCropDialog').props.onClose(); v.render();
    assert.equal(v.requests.length, 0);
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve => setImmediate(resolve)); v.render();
    assert.deepEqual(v.paths, ['/admin/short-videos/upload', '/admin/short-videos/1']);
});

test('valid portrait upload skips automatic crop and can save directly', async () => {
    const v = mount();
    v.input('short-video').props.onChange({ target: { files: [new File(['video'], 'portrait.mp4', { type: 'video/mp4' })], value: '' } }); v.render();
    v.all().find(n => n.type === 'video' && n.props.controls).props.onLoadedMetadata({ currentTarget: { videoWidth: 576, videoHeight: 1024, duration: 12, pause() {} } }); v.render();
    assert.equal(v.all().some(n => n.type === 'VideoCropDialog'), false);
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve => setImmediate(resolve)); v.render();
    assert.deepEqual(v.paths, ['/admin/short-videos/upload', '/admin/short-videos/1']);
});


test('confirmed crop uploads once and updates the upload player before draft save', async () => {
    const v = mount();
    v.input('short-video').props.onChange({ target: { files: [new File(['video'], 'wide.mp4', { type: 'video/mp4' })], value: '' } }); v.render();
    v.all().find(n => n.type === 'video' && n.props.controls).props.onLoadedMetadata({ currentTarget: { videoWidth: 1920, videoHeight: 1080, duration: 12, pause() {} } }); v.render();
    v.find('Sesuaikan / Pangkas Video').props.onSelect(); v.render();
    const dialog = v.all().find(n => n.type === 'VideoCropDialog');
    await dialog.props.onSave({ x: 0.5, y: 0.5, zoom: 1, start: 0, end: 12 });
    dialog.props.onClose(); v.render();
    assert.equal(v.all().find(n => n.type === 'video' && n.props.controls).props.src, '/new.mp4');
    assert.deepEqual(v.paths, ['/admin/short-videos/upload']);
    assert.equal(v.requests[0].get('edit[mode]'), 'crop');
    v.find('Simpan Draf').props.onClick();
    await new Promise(resolve => setImmediate(resolve)); v.render();
    assert.deepEqual(v.paths, ['/admin/short-videos/upload', '/admin/short-videos/1']);
    assert.equal(v.requests[1].get('title'), 'Draft');
    assert.equal(v.requests[1].get('description'), 'Description');
});


test('inline cover tabs replace the dialog and duplicate selected-cover section', () => {
    const v = mount();
    assert.equal(v.find('Pilih Sampul'), undefined);
    assert.deepEqual(v.all().filter(n => n.type === 'TabsTrigger').map(n => n.props.value), ['video', 'photo']);
    assert.equal(v.all().some(n => n.type === 'img' && n.props.alt === 'Sampul terpilih'), false);
    assert.equal(v.all().filter(n => n.type === 'DropdownMenuItem').length, 2);
    assert.ok(v.all().some(n => n.type === 'VideoFrameTimeline'));
    assert.equal(v.input('frame-offset'), undefined);
});

test('photo and frame survive tab switches and only active frame is sent to save', async () => {
    const v = mount();
    const videoCover = v.all().find(n => n.type?.name === 'SelectedCover');
    assert.equal(videoCover.props.detail, '00:02.0');
    assert.equal(videoCover.props.description, 'Posisi sampul pada video');
    v.all().find(n => n.type === 'Tabs').props.onValueChange('photo'); v.render();
    const photo = new File(['image'], 'chosen.png', { type: 'image/png' });
    v.all().find(n => n.type === 'input' && n.props['aria-label'] === 'Unggah sampul').props.onChange({ target: { files: [photo], value: '' } }); v.render();
    assert.equal(v.all().find(n => n.type === 'Tabs').props.value, 'photo');
    const photoCover = v.all().filter(n => n.type?.name === 'SelectedCover').at(-1);
    assert.equal(photoCover.props.detail, 'chosen.png');
    assert.equal(photoCover.props.description, 'Foto yang dipilih');
    assert.equal(photoCover.props.image, 'blob:chosen.png');
    v.all().find(n => n.type === 'Tabs').props.onValueChange('video'); v.render();
    v.all().find(n => n.type === 'VideoFrameTimeline').props.onSelect(4.5); v.render();
    v.all().find(n => n.type === 'Tabs').props.onValueChange('photo'); v.render();
    assert.equal(v.all().find(n => n.type === 'CoverPreview').props.source, 'blob:chosen.png');
    v.all().find(n => n.type === 'Tabs').props.onValueChange('video'); v.render();
    assert.equal(v.all().find(n => n.type === 'VideoFrameTimeline').props.offset, 4.5);
    v.find('Simpan Draf').props.onClick(); await new Promise(resolve => setImmediate(resolve)); v.render();
    assert.equal(v.requests[0].get('cover_mode'), 'frame');
    assert.equal(v.requests[0].get('cover'), null);
    assert.equal(v.requests[0].get('frame_offset'), '4.5');
    v.all().find(n => n.type === 'Tabs').props.onValueChange('photo'); v.render();
    v.find('Simpan Draf').props.onClick(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(v.requests[1].get('cover_mode'), 'upload');
    assert.equal(v.requests[1].get('cover').name, 'chosen.png');
});

test('publishing uses active photo after toggling away and back', async () => {
    const v = mount();
    const photo = new File(['image'], 'publish.png', {type:'image/png'});
    v.all().find(n => n.type === 'input' && n.props['aria-label'] === 'Unggah sampul').props.onChange({target:{files:[photo],value:''}}); v.render();
    v.all().find(n => n.type === 'Tabs').props.onValueChange('video'); v.render();
    v.all().find(n => n.type === 'Tabs').props.onValueChange('photo'); v.render();
    v.all().find(n => n.type === 'PublishNewsDialog').props.onPublish('local-preview');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(v.requests[0].get('cover_mode'), 'upload');
    assert.equal(v.requests[0].get('cover').name, 'publish.png');
    assert.ok(v.apiRequests.some(r => r.path.endsWith('/publish')));
});


test('cover crop icon opens saved original and settings; cancel is inert and Apply is persisted', async () => {
    const crop = {mode:'crop',x:0.2,y:0.8,zoom:2};
    const v=mount({...draft,metadata:{...draft.metadata,cover_source:'photo',cover_original:'/original.jpg',cover_crop:crop}});
    v.all().find(n=>n.props?.['aria-label']==='Pangkas Sampul').props.onClick(); v.render();
    let dialog=v.all().find(n=>n.type==='ShortCoverDialog');
    assert.equal(dialog.props.source,'/original.jpg');
    assert.equal(dialog.props.initial,crop);
    dialog.props.onClose(); v.render();
    assert.equal(v.dirty,false);
    assert.equal(v.requests.length,0);
    v.all().find(n=>n.props?.['aria-label']==='Pangkas Sampul').props.onClick(); v.render();
    dialog=v.all().find(n=>n.type==='ShortCoverDialog');
    dialog.props.onApply({...crop,mode:'fit'}); dialog.props.onClose(); v.render();
    assert.equal(v.dirty,true);
    v.find('Simpan Draf').props.onClick(); await new Promise(resolve=>setImmediate(resolve));
    assert.equal(v.requests[0].get('cover_crop[mode]'),'fit');
    assert.equal(v.requests[0].get('cover'),null);
});


test('saving draft shows its own spinner and stays on editor; publishing navigates only after confirmation', async () => {
    const v=mount(null);
    v.input('short-video').props.onChange({target:{files:[new File(['video'],'new.mp4',{type:'video/mp4'})],value:''}});
    v.input('short-title').props.onChange({target:{value:'New title'}});
    v.input('short-description').props.onChange({target:{value:'Description'}});
    v.render();
    v.find('Simpan Draf').props.onClick(); v.render();
    assert.equal(v.find('Publikasikan').props.disabled,true);
    assert.equal(v.find('Simpan Draf').props.disabled,true);
    assert.equal(v.find('Publikasikan').props.children.flat().some(n=>n?.type==='LoaderCircle'),false);
    assert.equal(v.find('Simpan Draf').props.children.flat().some(n=>n?.type==='LoaderCircle'),true);
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.deepEqual(v.visits,[]);
    assert.equal(v.all().find(n=>n.type==='FeedbackToast').props.feedback.message,'Draf berhasil disimpan');
    assert.equal(v.find('Simpan Draf').props.disabled,false);
    v.all().find(n=>n.type==='PublishNewsDialog').props.onPublish('local-preview');
    assert.deepEqual(Object.keys(v.events.at(-1).detail.result.results),['website']);
    assert.equal(v.events.at(-1).detail.result.results.website.status,'queued');
    assert.equal(v.events.at(-1).detail.ready,false);
    v.render();
    assert.equal(v.find('Simpan Draf').props.disabled,true);
    assert.equal(v.find('Publikasikan').props.children.flat().some(n=>n?.type==='LoaderCircle'),true);
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.equal(v.events.at(-1).detail.replaceId,v.events.at(-2).detail.id);
    assert.equal(v.events.at(-1).detail.ready,true);
    assert.deepEqual(v.visits,['/admin/short-videos']);
    assert.equal(v.visitOptions[0].replace, true);
});

for (const status of ['queued','processing','failed','ready']) {
    test(`reopened ${status} draft restores status and leaves draft editing enabled`, () => {
        const v=mount({...draft,metadata:{...draft.metadata,processing:{revision:'version-1',status}}});
        assert.equal(v.find('Simpan Draf').props.disabled,false);
        assert.equal(v.find('Publikasikan').props.disabled,status !== 'ready');
        assert.equal(v.input('short-title').props.disabled,false);
        assert.match(v.text(),status === 'failed' ? /Gagal memproses/ : status === 'ready' ? /Video siap/ : /Memproses video/);
        assert.equal(Boolean(v.find('Coba lagi')),status === 'failed');
        assert.equal(v.dirty,false);
    });
}

test('double click saves changed text only once', async () => {
    const v=mount();
    v.input('short-title').props.onChange({target:{value:'Changed'}});v.render();
    const save=v.find('Simpan Draf').props.onClick;
    save();save();
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.deepEqual(v.paths,['/admin/short-videos/1']);
});

test('processing polling updates ready media without overwriting unsaved text', async () => {
    const pending={...draft,metadata:{...draft.metadata,cover_source:'frame',processing:{revision:'v1',status:'processing'}}};
    const ready={...pending,video_url:'/ready.mp4',thumbnail_url:'/ready.jpg',metadata:{...pending.metadata,processing:{revision:'v1',status:'ready'}}};
    const v=mount(pending,{effects:true,latest:ready});
    v.input('short-title').props.onChange({target:{value:'Still editing'}});v.render();
    await v.tick();v.render();
    assert.equal(v.input('short-title').props.value,'Still editing');
    assert.equal(v.all().find(n=>n.type==='video'&&n.props.controls).props.src,'/ready.mp4');
    assert.equal(v.dirty,true);
    assert.equal(v.timerCount(),0);
    assert.match(v.text(),/Video siap/);
});

test('processing completion keeps a saved draft clean and stops polling', async () => {
    const pending={...draft,metadata:{...draft.metadata,cover_source:'frame',processing:{revision:'v1',status:'queued'}}};
    const ready={...pending,video_url:'/ready.mp4',thumbnail_url:'/ready.jpg',metadata:{...pending.metadata,processing:{revision:'v1',status:'ready'}}};
    const v=mount(pending,{effects:true,latest:ready});
    await v.tick();v.render();
    assert.equal(v.dirty,false);
    assert.equal(v.timerCount(),0);
    assert.equal(v.find('Publikasikan').props.disabled,false);
    assert.equal(v.find('Simpan Draf').props.disabled,false);
});

test('save reports success and stops loading while background processing continues', async () => {
    const pending={...draft,id:2,frame_offset:0,video_url:'/original.mp4',thumbnail_url:'',metadata:{duration:20,cover_source:'frame',processing:{revision:'v1',status:'queued'}}};
    const v=mount(null,{progress:true,respond:(_path,body)=>({...pending,title:body.get('title')??'',description:body.get('description')??''})});
    v.input('short-video').props.onChange({target:{files:[new File(['video'],'new.mp4',{type:'video/mp4'})],value:''}});v.render();
    v.find('Simpan Draf').props.onClick();v.render();
    assert.match(v.text(),/Mengunggah video/);
    assert.equal(v.find('Simpan Draf').props.disabled,true);
    await new Promise(resolve=>setImmediate(resolve));v.render();
    assert.equal(v.find('Simpan Draf').props.disabled,false);
    assert.equal(v.find('Publikasikan').props.disabled,true);
    assert.equal(v.all().find(n=>n.type==='FeedbackToast').props.feedback.message,'Draf berhasil disimpan');
    assert.match(v.text(),/Memproses video/);
    assert.equal(v.dirty,false);
    assert.equal(v.visits.length,0);
});

test('retry restores pending processing without uploading saved media', async () => {
    const failed={...draft,metadata:{...draft.metadata,processing:{revision:'v1',status:'failed'}}};
    const pending={...failed,metadata:{...failed.metadata,processing:{revision:'v2',status:'queued'}}};
    const v=mount(failed,{respond:()=>pending});
    await v.find('Coba lagi').props.onClick();v.render();
    assert.deepEqual(v.paths,['/admin/short-videos/1/processing/retry']);
    assert.match(v.text(),/Memproses video/);
    assert.equal(v.find('Simpan Draf').props.disabled,false);
    assert.equal(v.find('Publikasikan').props.disabled,true);
});


test('playing and seeking move only playback position, never the saved cover',()=>{
    const v=mount({...draft,metadata:{...draft.metadata,cover_source:'frame'}});
    let main=v.all().find(n=>n.type==='video'&&n.props.controls);
    main.props.onTimeUpdate({currentTarget:{currentTime:12.25}});v.render();
    let timeline=v.all().find(n=>n.type==='VideoFrameTimeline');
    assert.equal(timeline.props.playbackTime,12.25);
    assert.equal(timeline.props.offset,2);
    assert.equal(v.dirty,false);
    main=v.all().find(n=>n.type==='video'&&n.props.controls);
    main.props.onSeeking({currentTarget:{currentTime:8.75}});v.render();
    timeline=v.all().find(n=>n.type==='VideoFrameTimeline');
    assert.equal(timeline.props.playbackTime,8.75);
    assert.equal(timeline.props.offset,2);
    assert.equal(v.all().find(n=>n.type?.name==='SelectedCover').props.image,'/saved.jpg');
    assert.equal(v.requests.length,0);
    assert.equal(v.apiRequests.length,0);
});

test('thumbnail selection pauses and seeks the main player, persists exact time, and stays fixed during playback',async()=>{
    const v=mount({...draft,metadata:{...draft.metadata,cover_source:'frame'}});
    let pauses=0;
    const main=v.all().find(n=>n.type==='video'&&n.props.controls);
    const media={currentTime:7,pause(){pauses++;}};
    main.props.ref.current=media;
    v.all().find(n=>n.type==='VideoFrameTimeline').props.onSelect(4.512);v.render();
    assert.equal(pauses,1);
    assert.equal(media.currentTime,4.512);
    assert.equal(v.all().find(n=>n.type==='VideoFrameTimeline').props.offset,4.512);
    assert.equal(v.find('Ganti Sampul'),undefined);
    v.all().find(n=>n.type==='video'&&n.props.controls).props.onTimeUpdate({currentTarget:{currentTime:9}});v.render();
    assert.equal(v.all().find(n=>n.type==='VideoFrameTimeline').props.offset,4.512);
    assert.equal(v.requests.length,0);
    v.find('Simpan Draf').props.onClick();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(v.requests[0].get('frame_offset'),'4.512');
    assert.equal(v.requests[0].get('cover_mode'),'frame');
});
