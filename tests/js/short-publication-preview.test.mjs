import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const data = {token:'confirmed-preview',video_url:'/edited.mp4',thumbnail_url:'/cover.jpg',title:'Kegiatan warga',content:'Deskripsi video asli',caption:'Kegiatan warga\n\nDeskripsi video asli',images:{website:null,instagram:null,facebook:null},issues:{}};
const platforms = ['website','instagram','facebook'].map(id=>({id,account:`account_${id}`,status:'connected',publishable:true}));
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n,...nodes(n.props?.children)];
const label = n => n == null ? '' : typeof n !== 'object' ? String(n) : Array.isArray(n) ? n.map(label).join('') : label(n.props?.children);

function mount(file, component, props, mobile = false) {
    const slots = [], effects = []; let cursor=0, tree;
    const context = {exports:{},require(name) {
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'react') return {
            useState(initial) {const i=cursor++; if (!(i in slots)) slots[i]=initial; return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
            useRef(initial) {const i=cursor++; return slots[i]??={current:initial};},
            useEffect(fn) {effects.push(fn);},
        };
        if (name === '@/hooks/use-mobile') return {useIsMobile:()=>mobile};
        if (name === '@/components/publication-preview') return {PlatformIcon:'PlatformIcon',PublicationPreview:'PublicationPreview',platformNames:{website:'Aplikasi',instagram:'Instagram',facebook:'Facebook'}};
        return new Proxy({}, {get:(_,key)=>String(key)});
    }};
    vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
    const render = (next={}) => {Object.assign(props,next);cursor=0;effects.length=0;tree=nodes(context.exports[component](props));};
    render();
    return {render,effects,all:()=>tree,find:match=>tree.find(match),button:text=>tree.find(n=>n.type==='Button'&&label(n).includes(text)),text:()=>tree.map(label).join(' ')};
}
const previewFile='resources/js/components/short-publication-preview.tsx';

test('all viewport sizes use tabs and mount exactly one current edited-video player',()=>{
    for (const mobile of [false,true]) {
        const selected=['facebook','instagram'];
        const view=mount(previewFile,'ShortPublicationPreview',{data,selected,platforms},mobile);
        const cards=()=>view.all().filter(n=>typeof n.type==='function');
        assert.deepEqual(view.all().filter(n=>n.type==='TabsTrigger').map(n=>n.props.value),['website','instagram','facebook']);
        assert.equal(cards().length,1);
        assert.equal(cards()[0].props.platform,'website');
        for (const id of ['instagram','facebook','website','instagram']) {
            view.find(n=>n.type==='Tabs').props.onValueChange(id); view.render();
            assert.equal(cards().length,1);
            assert.equal(cards()[0].props.platform,id);
            assert.equal(cards()[0].props.data.video_url,'/edited.mp4');
            assert.equal(cards()[0].props.data.thumbnail_url,'/cover.jpg');
            assert.equal(cards()[0].props.accountName,`account_${id}`);
            assert.equal(cards()[0].props.playingPlatform,null);
        }
        assert.deepEqual(selected,['facebook','instagram']);
        view.render({selected:['facebook']});
        assert.equal(cards()[0].props.platform,'website');
        assert.deepEqual(view.all().filter(n=>n.type==='TabsTrigger').map(n=>n.props.value),['website','facebook']);
        view.render({data:{...data,video_url:'/new-edit.mp4'}});
        assert.equal(cards()[0].props.data.video_url,'/new-edit.mp4');
        assert.match(cards()[0].key,/new-edit/);
    }
});

test('platform player uses real media and caption, supports playback mute seek and expansion', async()=>{
    const played=[];
    const view=mount(previewFile,'ShortPlatformPreview',{data,platform:'instagram',accountName:'@desa_resmi',playingPlatform:null,onPlay:id=>played.push(id)});
    const video=()=>view.find(n=>n.type==='video');
    const player={paused:true,currentTime:0,pause(){this.paused=true;},async play(){this.paused=false;}};
    video().props.ref.current=player;
    assert.equal(video().props.src,data.video_url);
    assert.equal(video().props.poster,data.thumbnail_url);
    assert.equal(video().props.autoPlay,undefined);
    assert.match(video().props.className,/object-contain/);
    assert.match(view.text(),/@desa_resmi/);
    assert.match(view.text(),/Kegiatan warga/);
    await view.button('')?.props.onClick?.();
    video().props.onPlay();view.render();assert.deepEqual(played,['instagram']);
    view.find(n=>n.props?.['aria-label']==='Bunyikan Instagram').props.onClick();view.render();assert.equal(video().props.muted,false);
    video().props.onLoadedMetadata({currentTarget:{duration:20}});view.render();
    view.find(n=>n.type==='input').props.onChange({target:{value:'7.5'}});view.render();assert.equal(player.currentTime,7.5);
    view.find(n=>n.props?.['aria-controls']==='short-caption-instagram').props.onClick();view.render();
    assert.equal(view.find(n=>n.props?.['aria-controls']==='short-caption-instagram').props['aria-expanded'],true);
    view.render({playingPlatform:'facebook'});view.effects[0]();assert.equal(player.paused,true);
    assert.equal(view.all().some(n=>n.type==='button'&&n.props.onClick&&label(n)==='Suka'),false);
});

test('each platform has its own illustrative actions without fabricated engagement',()=>{
    for (const platform of ['website','instagram','facebook']) {
        const view=mount(previewFile,'ShortPlatformPreview',{data,platform,accountName:'Halaman nyata',playingPlatform:null,onPlay(){}});
        const actions=view.all().filter(n=>n.props?.role==='img');
        assert.deepEqual(actions.map(n=>n.props['aria-label']),platform==='instagram'?['Suka','Komentar','Bagikan','Simpan']:['Suka','Komentar','Bagikan']);
        assert.equal(actions.some(n=>/\d/.test(label(n))),false);
        if (platform==='website') assert.match(view.text(),/Deskripsi video asli/);
    }
});

test('opening video preview and returning do not publish; final button sends the preview token', async()=>{
    const published=[];
    const view=mount('resources/js/components/publish-news-dialog.tsx','PublishNewsDialog',{open:true,onOpenChange(){},platforms,metaAuth:{},selected:['website','instagram'],onSelectionChange(){},processing:false,videoMode:true,onPreparePreview:async()=>data,onPublish:token=>published.push(token)});
    view.button('Lihat Pratinjau').props.onClick();await new Promise(resolve=>setImmediate(resolve));view.render();
    assert.equal(published.length,0);
    assert.ok(view.find(n=>n.type==='ShortPublicationPreview'));
    assert.equal(view.find(n=>n.type==='PublicationPreview'),undefined);
    view.button('Kembali').props.onClick();view.render();assert.equal(published.length,0);
    view.button('Lihat Pratinjau').props.onClick();await new Promise(resolve=>setImmediate(resolve));view.render();
    view.button('Terbitkan Sekarang').props.onClick();assert.deepEqual(published,['confirmed-preview']);
});

test('disconnected selected accounts still block final confirmation and news retains its own preview',async()=>{
    for (const videoMode of [true,false]) {
        const published=[];
        const view=mount('resources/js/components/publish-news-dialog.tsx','PublishNewsDialog',{open:true,onOpenChange(){},platforms:platforms.map(p=>p.id==='instagram'?{...p,status:'expired'}:p),metaAuth:{},selected:['website','instagram'],onSelectionChange(){},processing:false,videoMode,onPreparePreview:async()=>data,onPublish:token=>published.push(token)});
        view.button('Lihat Pratinjau').props.onClick();await new Promise(resolve=>setImmediate(resolve));view.render();
        assert.equal(view.button('Terbitkan Sekarang').props.disabled,true);
        view.button('Terbitkan Sekarang').props.onClick();assert.equal(published.length,0);
        if (!videoMode) assert.ok(view.find(n=>n.type==='PublicationPreview'));
    }
});


test('all platform players report storage failures and retry loading on explicit play',async()=>{
    for (const platform of ['website','instagram','facebook']) {
        const view=mount(previewFile,'ShortPlatformPreview',{data,platform,accountName:'Saved account',playingPlatform:null,onPlay(){}});
        let loads=0,plays=0,pauses=0;
        const player={paused:true,error:{code:2},load(){loads++;},async play(){plays++;},pause(){pauses++;}};
        const video=view.find(n=>n.type==='video');
        video.props.ref.current=player;
        video.props.onError({currentTarget:player});view.render();
        assert.match(view.text(),/penyimpanan/);
        await view.find(n=>n.type==='Button'&&n.props['aria-label'].startsWith('Putar ')).props.onClick();
        await new Promise(resolve=>setImmediate(resolve));
        assert.equal(loads,1);assert.equal(plays,1);
        const cleanup=view.effects[1]();cleanup();assert.equal(pauses,1);
    }
});
