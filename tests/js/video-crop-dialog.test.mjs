import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = (path) =>
    ts.transpileModule(readFileSync(path, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
        },
    }).outputText;
const geometry = { exports: {} };
vm.runInNewContext(compile('resources/js/lib/video-crop.ts'), geometry);
const compiled = compile('resources/js/components/video-crop-dialog.tsx');
const nodes = (node) =>
    !node || typeof node !== 'object'
        ? []
        : Array.isArray(node)
          ? node.flatMap(nodes)
          : [node, ...nodes(node.props?.children)];

function mount(initial, fail = false) {
    const slots = [];
    let cursor = 0;
    let closed = 0;
    const saved = [];
    const context = {
        exports: {},
        require(name) {
            if (name === 'react/jsx-runtime') return require(name);
            if (name === '@/lib/video-crop') return geometry.exports;
            if (name === 'react')
                return {
                    useState(value) {
                        const i = cursor++;
                        if (!(i in slots)) slots[i] = value;
                        return [
                            slots[i],
                            (next) => {
                                slots[i] =
                                    typeof next === 'function'
                                        ? next(slots[i])
                                        : next;
                            },
                        ];
                    },
                    useRef(value) {
                        const i = cursor++;
                        if (!(i in slots)) slots[i] = { current: value };
                        return slots[i];
                    },
                };
            return new Proxy({}, { get: (_, key) => String(key) });
        },
    };
    vm.runInNewContext(compiled, context);
    const player = {
        videoWidth: 576,
        videoHeight: 1024,
        duration: 12,
        currentTime: 0,
        pause() {},
        play: async () => {},
    };
    let tree;
    const render = () => {
        cursor = 0;
        tree = nodes(
            context.exports.VideoCropDialog({
                source: '/original.mp4',
                initial,
                onClose: () => closed++,
                onSave: async (crop) => {
                    if (fail) throw new Error('Export failed');
                    saved.push(crop);
                },
            }),
        );
        tree.find((n) => n.type === 'video').props.ref.current = player;
        return tree;
    };
    render();
    tree.find((n) => n.type === 'video').props.onLoadedMetadata({
        currentTarget: player,
    });
    render();
    return {
        render,
        saved,
        get closed() {
            return closed;
        },
        get tree() {
            return tree;
        },
        find: (label) => tree.find((n) => n.props?.['aria-label'] === label),
        save: () =>
            tree.find(
                (n) =>
                    n.type === 'Button' &&
                    n.props.children?.includes?.('Terapkan'),
            ),
    };
}

test('unchanged portrait disables export; zoom saves explicit settings', async () => {
    const view = mount();
    assert.equal(view.save().props.disabled, true);
    view.find('Zoom video').props.onChange({ target: { value: '2' } });
    view.render();
    assert.equal(view.save().props.disabled, false);
    await view.save().props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(view.saved.length, 1);
    assert.equal(view.saved[0].zoom, 2);
    assert.equal(view.closed, 1);
});

test('cancel never exports; reopening saved geometry is unchanged', () => {
    const view = mount({ x: 0.2, y: 0.8, zoom: 2, start: 1, end: 10 });
    assert.equal(view.save().props.disabled, true);
    view.tree
        .find((n) => n.type === 'Button' && n.props.children === 'Batal')
        .props.onClick();
    assert.equal(view.closed, 1);
    assert.equal(view.saved.length, 0);
});

test('keyboard pan and trim update the export selection while failure retains the editor', async () => {
    const view = mount({ x: 0.5, y: 0.5, zoom: 2, start: 0, end: 12 }, true);
    view.tree
        .find((n) => n.props?.role === 'group')
        .props.onKeyDown({ key: 'ArrowLeft', preventDefault() {} });
    view.render();
    view.tree.find((n) => n.type === 'VideoTrimTimeline').props.onStart(2);
    view.render();
    view.tree.find((n) => n.type === 'VideoTrimTimeline').props.onEnd(9);
    view.render();
    await view.save().props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    view.render();
    assert.equal(view.closed, 0);
    assert.equal(view.save().props.disabled, false);
    assert.ok(view.tree.some((n) => n.props?.role === 'alert'));
    const timeline = view.tree.find((n) => n.type === 'VideoTrimTimeline');
    assert.equal(timeline.props.start, 2);
    assert.equal(timeline.props.end, 9);
});

test('trim selection controls playback endpoint and saves its range', async () => {
    const view = mount();
    const timeline = () =>
        view.tree.find((n) => n.type === 'VideoTrimTimeline');
    timeline().props.onStart(2);
    view.render();
    timeline().props.onEnd(8);
    view.render();
    const player = view.tree.find((n) => n.type === 'video');
    player.props.onTimeUpdate({
        currentTarget: { currentTime: 8.1, pause() {} },
    });
    view.render();
    assert.equal(timeline().props.currentTime, 8);
    await view.save().props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(view.saved[0].start, 2);
    assert.equal(view.saved[0].end, 8);
});
