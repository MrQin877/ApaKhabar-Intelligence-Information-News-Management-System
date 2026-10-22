import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../resources/js/hooks/use-mobile.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function mount(width, initialFontSize = 16) {
    const listeners = new Set();
    let query;
    const media = {
        get matches() { return width >= 48 * initialFontSize; },
        addEventListener: (_, listener) => listeners.add(listener),
        removeEventListener: (_, listener) => listeners.delete(listener),
    };
    let snapshot;
    let cleanup;
    const context = {
        exports: {},
        window: { matchMedia(value) { query = value; return media; } },
        require: () => ({ useSyncExternalStore(subscribe, getSnapshot) {
            cleanup ??= subscribe(() => { snapshot = getSnapshot(); });
            snapshot = getSnapshot();
            return snapshot;
        } }),
    };
    vm.runInNewContext(compiled, context);
    context.exports.useIsMobile();
    assert.equal(query, '(min-width: 48rem)');
    return {
        get mobile() { return snapshot; },
        resize(value) {
            const previous = media.matches;
            width = value;
            if (previous !== media.matches) listeners.forEach(listener => listener({ matches: media.matches }));
        },
        unmount() { cleanup(); assert.equal(listeners.size, 0); },
    };
}

test('mobile and desktop cover fractional, snapped and full-screen widths without a gap', () => {
    const hook = mount(1920);
    for (const width of [1024, 900, 800, 768, 767.99, 767.5, 767, 640, 375, 800, 1920]) {
        hook.resize(width);
        assert.equal(hook.mobile, width < 768, `viewport ${width}`);
    }
    hook.unmount();
});

test('responsive mode follows Tailwind rem boundary with a larger browser default font', () => {
    const hook = mount(1024, 20);
    for (const width of [960, 959.5, 900, 800, 1024]) {
        hook.resize(width);
        assert.equal(hook.mobile, width < 960, `viewport ${width}`);
    }
    hook.unmount();
});
