import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(
    readFileSync('resources/js/components/video-trim-timeline.tsx', 'utf8'),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
        },
    },
).outputText;
const nodes = (node) =>
    !node || typeof node !== 'object'
        ? []
        : Array.isArray(node)
          ? node.flatMap(nodes)
          : [node, ...nodes(node.props?.children)];

function mount() {
    const refs = [];
    let refIndex = 0;
    const changes = [];
    const state = {
        source: '/original.mp4',
        duration: 12,
        start: 2,
        end: 10,
        currentTime: 4,
        disabled: false,
        onStart: (value) => {
            changes.push(['start', value]);
            state.start = value;
        },
        onEnd: (value) => {
            changes.push(['end', value]);
            state.end = value;
        },
        onSeek: (value) => changes.push(['seek', value]),
    };
    const context = {
        exports: {},
        require(name) {
            if (name === 'react/jsx-runtime') return require(name);
            if (name === '@/components/video-frame-timeline')
                return { useVideoFrames: () => ({ images: Array(8).fill('/frame.jpg') }) };
            if (name === 'react')
                return {
                    useRef(initial) {
                        const index = refIndex++;
                        if (!(index in refs))
                            refs[index] = { current: initial };
                        return refs[index];
                    },
                };
            throw new Error(`Unexpected dependency: ${name}`);
        },
    };
    vm.runInNewContext(compiled, context);
    const render = () => {
        refIndex = 0;
        const tree = nodes(context.exports.VideoTrimTimeline(state));
        refs[0].current = {
            getBoundingClientRect: () => ({ left: 0, width: 100 }),
        };
        return tree;
    };
    return { state, changes, render };
}

test('filmstrip handles update start and end with clamped pointer positions', () => {
    const view = mount();
    let tree = view.render();
    const handle = (label) =>
        tree.find((node) => node.props?.['aria-label'] === label);
    const left = handle('Awal potongan');
    assert.match(left.props.className, /cursor-grab.*active:cursor-grabbing/);
    left.props.onPointerDown({
        pointerId: 1,
        stopPropagation() {},
        currentTarget: { setPointerCapture() {} },
    });
    left.props.onPointerMove({ clientX: 50 });
    left.props.onPointerUp({ clientX: 50 });
    assert.deepEqual(view.changes.at(-1), ['start', 6]);
    tree = view.render();
    const right = handle('Akhir potongan');
    right.props.onPointerDown({
        pointerId: 2,
        stopPropagation() {},
        currentTarget: { setPointerCapture() {} },
    });
    right.props.onPointerMove({ clientX: 0 });
    right.props.onPointerUp({ clientX: 0 });
    assert.deepEqual(view.changes.at(-1), ['end', 6.1]);
    tree = view.render();
    assert.equal(handle('Awal potongan').props['aria-valuenow'], 6);
    assert.equal(handle('Akhir potongan').props['aria-valuenow'], 6.1);
    assert.ok(
        tree.some((node) =>
            String(node.props?.children).includes('Durasi dipilih:'),
        ),
    );
});

test('filmstrip click seeks within selection and keyboard adjusts handles', () => {
    const view = mount();
    let tree = view.render();
    const track = tree.find((node) =>
        node.props?.className?.includes('cursor-grab'),
    );
    assert.doesNotMatch(track.props.className, /cursor-crosshair/);
    track.props.onPointerDown({
        target: track,
        currentTarget: track,
        clientX: 100,
    });
    assert.deepEqual(view.changes.at(-1), ['seek', 10]);
    const left = tree.find(
        (node) => node.props?.['aria-label'] === 'Awal potongan',
    );
    left.props.onKeyDown({
        key: 'ArrowRight',
        shiftKey: true,
        preventDefault() {},
    });
    assert.deepEqual(view.changes.at(-1), ['start', 3]);
    view.state.disabled = true;
    tree = view.render();
    assert.equal(
        tree.find((node) => node.props?.['aria-label'] === 'Awal potongan')
            .props.tabIndex,
        -1,
    );
});
