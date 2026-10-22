import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(
    'resources/js/components/video-frame-timeline.tsx',
    'utf8',
);
const compiled = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
    },
}).outputText;

function mount(duration = 15, disabled = false) {
    const refs = [];
    let cursor = 0;
    let selected = 0;
    let prevented = 0;
    const context = {
        exports: {},
        require(name) {
            if (name === 'react/jsx-runtime') return require(name);
            if (name === 'react')
                return {
                    useState(initial) {
                        return [initial, () => {}];
                    },
                    useRef(initial) {
                        const index = cursor++;
                        return (refs[index] ??= { current: initial });
                    },
                    useEffect() {},
                };
            throw new Error(name);
        },
    };
    vm.runInNewContext(compiled, context);
    const render = () => {
        cursor = 0;
        return context.exports.VideoFrameTimeline({
            source: '/short.mp4',
            duration,
            offset: selected,
            disabled,
            onSelect: (value) => {
                selected = value;
            },
        });
    };
    const target = {
        getBoundingClientRect: () => ({ left: 20, width: 200 }),
        setPointerCapture() {},
    };
    const pointer = (x) => ({
        clientX: x,
        pointerId: 1,
        currentTarget: target,
    });
    const key = (name) => ({
        key: name,
        shiftKey: false,
        preventDefault() {
            prevented++;
        },
    });
    return {
        render,
        pointer,
        key,
        get selected() {
            return selected;
        },
        get prevented() {
            return prevented;
        },
    };
}

test('click and drag use the full filmstrip continuously, including edges', () => {
    const view = mount();
    let strip = view.render();
    assert.match(strip.props.className, /cursor-grab.*active:cursor-grabbing/);
    strip.props.onPointerDown(view.pointer(120));
    assert.equal(view.selected, 7.5);
    strip.props.onPointerMove(view.pointer(180));
    assert.equal(view.selected, 11.9);
    strip.props.onPointerUp(view.pointer(240));
    assert.equal(view.selected, 14.9);
    strip.props.onPointerMove(view.pointer(20));
    assert.equal(
        view.selected,
        14.9,
        'moving after release must not change the frame',
    );
    strip = view.render();
    assert.equal(strip.props['aria-valuenow'], 14.9);
    strip.props.onPointerDown(view.pointer(10));
    assert.equal(view.selected, 0);
    strip.props.onPointerCancel();
    strip.props.onPointerMove(view.pointer(120));
    assert.equal(view.selected, 0);
});

test('keyboard selection is bounded and disabled strip ignores input', () => {
    const view = mount(3);
    let strip = view.render();
    strip.props.onKeyDown(view.key('End'));
    assert.equal(view.selected, 2.9);
    strip = view.render();
    strip.props.onKeyDown(view.key('ArrowRight'));
    assert.equal(view.selected, 2.9);
    strip.props.onKeyDown(view.key('Home'));
    assert.equal(view.selected, 0);
    assert.equal(view.prevented, 3);
    const disabled = mount(3, true);
    strip = disabled.render();
    assert.equal(strip.props.tabIndex, -1);
    strip.props.onPointerDown(disabled.pointer(120));
    strip.props.onKeyDown(disabled.key('End'));
    assert.equal(disabled.selected, 0);
});
