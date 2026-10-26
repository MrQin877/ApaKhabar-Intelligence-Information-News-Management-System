import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('resources/js/components/short-cover-dialog.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
function mount(initial = {mode:'fit',x:0.5,y:0.5,zoom:1}) {
    const slots = [], applied = []; let cursor = 0, closed = 0, tree;
    const context = {exports:{}, require(name) {
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'react') return {
            useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
            useRef(value) { const i = cursor++; return slots[i] ??= {current:value}; },
        };
        return new Proxy({}, {get: (_, key) => String(key)});
    }};
    vm.runInNewContext(compiled, context);
    const render = () => { cursor = 0; tree = nodes(context.exports.ShortCoverDialog({source:'/original.jpg',initial,onClose:()=>closed++,onApply:crop=>applied.push(crop)})); };
    render();
    tree.find(n=>typeof n.type === 'function').props.onSize({width:1920,height:1080}); render();
    return {render,applied,get closed(){return closed;}, find: label=>tree.find(n=>n.props?.['aria-label'] === label || n.props?.children === label), preview:()=>tree.find(n=>typeof n.type === 'function').props, exports:context.exports};
}

test('cover Fit starts centered and Cancel never applies pending Crop changes', () => {
    const view=mount();
    assert.equal(view.find('Zoom sampul').props.disabled,true);
    view.find('Pangkas (Crop)').props.onClick(); view.render();
    view.find('Zoom sampul').props.onChange({target:{value:'2'}}); view.render();
    view.find('Batal').props.onClick();
    assert.equal(view.closed,1);
    assert.equal(view.applied.length,0);
});

test('cover drag and zoom are bounded and only Apply commits geometry', () => {
    const view=mount({mode:'crop',x:0.5,y:0.5,zoom:2});
    const area=()=>view.find('Pratinjau sampul 9:16');
    area().props.onPointerDown({clientX:100,clientY:100,pointerId:1,currentTarget:{setPointerCapture(){}}});
    area().props.onPointerMove({clientX:10000,clientY:-10000,currentTarget:{getBoundingClientRect:()=>({width:180,height:320})}}); view.render();
    assert.equal(view.preview().crop.x,0);
    assert.equal(view.preview().crop.y,1);
    assert.equal(view.applied.length,0);
    view.find('Terapkan').props.onClick();
    assert.equal(view.applied.length,1);
    assert.equal(view.applied[0].zoom,2);
    assert.equal(view.closed,1);
});

test('switching from Crop to Fit ignores stored pan and zoom in the preview', () => {
    const view=mount({mode:'crop',x:0,y:1,zoom:4});
    view.find('Sesuaikan (Fit)').props.onClick(); view.render();
    const preview=nodes(view.exports.CoverPreview({source:'/original.jpg',crop:view.preview().crop}));
    const foreground=preview.find(n=>n.props?.alt==='Foto sampul terpilih');
    assert.equal(foreground.props.style.objectFit,'contain');
    assert.equal(foreground.props.style.objectPosition,'50% 50%');
    assert.equal(foreground.props.style.transform,undefined);
});
