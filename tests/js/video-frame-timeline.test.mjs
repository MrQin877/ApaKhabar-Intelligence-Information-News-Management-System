import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('resources/js/components/video-frame-timeline.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
function mount({duration=47,offset=30.5,disabled=false}={}) {
    let selected=offset, playback=0, tree;
    const context={exports:{},require(name){
        if(name==='react/jsx-runtime')return require(name);
        if(name==='react')return {useState:initial=>[initial,()=>{}],useEffect(){}};
        throw new Error(name);
    }};
    vm.runInNewContext(compiled,context);
    const render=()=>{tree=context.exports.VideoFrameTimeline({source:'/video.mp4',duration,offset:selected,playbackTime:playback,disabled,onSelect:time=>{selected=time;}});};
    render();
    return {render,all:()=>nodes(tree),get selected(){return selected;},play(time){playback=time;render();},format:context.exports.formatFrameTime};
}

test('playback and cover lines move independently',()=>{
    const v=mount();
    const cover=v.all().find(n=>n.props?.['data-cover-indicator']).props.style.left;
    const before=v.all().find(n=>n.props?.['data-playback-indicator']).props.style.left;
    v.play(15);
    assert.notEqual(v.all().find(n=>n.props?.['data-playback-indicator']).props.style.left,before);
    assert.equal(v.all().find(n=>n.props?.['data-cover-indicator']).props.style.left,cover);
    assert.equal(v.selected,30.5);
});

test('the continuous filmstrip uses a draggable precise range instead of cards',()=>{
    const v=mount();
    const range=v.all().find(n=>n.type==='input');
    assert.equal(range.props['aria-label'],'Posisi sampul video');
    assert.equal(range.props.step,0.001);
    assert.equal(v.all().filter(n=>n.props?.['data-cover-frame']).length,0);
    assert.equal(v.all().filter(n=>n.type==='img').length,0);
    range.props.onChange({currentTarget:{value:'30.512'}});v.render();
    assert.equal(v.selected,30.512);
    assert.equal(v.all().find(n=>n.props?.['data-cover-indicator']).props.style.left,`${30.512/46.9*100}%`);
});

test('disabled or short media keep finite indicators',()=>{
    for(const duration of [0,0.05,47]){
        const v=mount({duration,offset:0,disabled:true});
        assert.equal(v.all().find(n=>n.type==='input').props.disabled,true);
        assert.doesNotMatch(v.all().find(n=>n.props?.['data-cover-indicator']).props.style.left,/NaN|Infinity/);
    }
});

test('timestamps include tenths and carry into the next minute',()=>{
    const v=mount();
    assert.equal(v.format(30.5),'00:30.5');
    assert.equal(v.format(59.99),'01:00.0');
    assert.equal(v.format(900),'15:00.0');
});
