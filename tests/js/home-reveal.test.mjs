import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(
    new URL('../../resources/js/lib/home-reveal.ts', import.meta.url),
    'utf8',
);
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function load(observer, reduced = false) {
    const context = {
        exports: {},
        require,
        IntersectionObserver: observer,
        window: { matchMedia: () => ({ matches: reduced }) },
    };
    vm.runInNewContext(compiled, context);

    return context.exports.observeHomeReveals;
}

function root(elements) {
    return { querySelectorAll: () => elements };
}

test('reveals each homepage element only once when it intersects', () => {
    const observed = [];
    const unobserved = [];
    let onIntersect;
    let disconnected = false;

    class Observer {
        constructor(callback) {
            onIntersect = callback;
        }

        observe(element) {
            observed.push(element);
        }

        unobserve(element) {
            unobserved.push(element);
        }

        disconnect() {
            disconnected = true;
        }
    }

    const first = { dataset: {} };
    const second = { dataset: {} };
    const stop = load(Observer)(root([first, second]));
    assert.equal(first.dataset.homeReveal, 'pending');
    assert.equal(observed.length, 2);

    onIntersect([{ target: first, isIntersecting: true }]);
    assert.equal(first.dataset.homeReveal, 'visible');
    assert.deepEqual(unobserved, [first]);
    assert.equal(second.dataset.homeReveal, 'pending');

    onIntersect([{ target: second, isIntersecting: true }]);
    stop();
    assert.equal(second.dataset.homeReveal, 'visible');
    assert.equal(disconnected, true);

    load(Observer)(root([first, second]));
    assert.equal(observed.length, 2);
});

test('leaves content visible without IntersectionObserver or with reduced motion', () => {
    const element = { dataset: {} };
    load(undefined)(root([element]));
    assert.equal(element.dataset.homeReveal, undefined);

    class Observer {
        observe() {
            throw new Error('should not observe with reduced motion');
        }
    }

    load(Observer, true)(root([element]));
    assert.equal(element.dataset.homeReveal, undefined);
});
