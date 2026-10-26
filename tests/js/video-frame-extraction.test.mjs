import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('resources/js/components/video-frame-timeline.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function harness(permanentFailure = false) {
    const updates = [];
    const effects = [];
    let created = 0;
    let failAt = 3;
    const videos = [];
    const context = { exports: {}, window: { setTimeout, clearTimeout }, document: { createElement(type) {
        if (type === 'canvas') return { width: 0, height: 0, getContext() { return { fillRect() {}, drawImage(video) { if (permanentFailure && Math.abs(video.currentTime - (3 / 11) * 46.9) < 0.01) throw new Error('bad frame'); if (created === failAt) { failAt = -1; throw new Error('one bad frame'); } } }; }, toDataURL() { return `data:image/jpeg;base64,${++created}`; } };
        const listeners = new Map();
        const video = { readyState: 0, videoWidth: 1080, videoHeight: 1920, _time: 0,
            addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
            set src(value) { this.readyState = 2; setTimeout(() => listeners.get('loadeddata')?.(), 0); },
            set currentTime(value) { this._time = value; setTimeout(() => listeners.get('seeked')?.(), 0); }, get currentTime() { return this._time; },
            removeAttribute() {}, load() {},
        };
        videos.push(video);
        return video;
    } }, require(name) {
        if (name === 'react') return { useState(initial) { const index = updates.length; updates.push(initial); return [initial, value => { updates[index] = typeof value === 'function' ? value(updates[index]) : value; }]; }, useEffect(callback) { effects.push(callback); } };
        if (name === 'react/jsx-runtime') return require(name);
        throw new Error(name);
    } };
    vm.runInNewContext(compiled, context);
    return { hook: context.exports.useVideoFrames, effects, updates, videos };
}

const settle = async () => new Promise(resolve => setTimeout(resolve, 500));

test('frames load automatically, one capture failure does not block later frames, and remount uses cache', async () => {
    const first = harness();
    first.hook('blob:filmstrip-test', 47);
    const cleanup = first.effects[0]();
    await settle();
    assert.equal(first.updates[0].images.filter(Boolean).length, 12);
    assert.equal(first.updates[0].failed, false);
    cleanup();
    first.hook('blob:filmstrip-test', 47);
    first.effects[1]();
    assert.equal(first.videos.length, 1);
    assert.equal(first.updates[2].images.filter(Boolean).length, 12);
});

test('a permanently failed frame leaves later frames visible and exposes retry', async () => {
    const view = harness(true);
    view.hook('blob:filmstrip-failed', 47);
    view.effects[0]();
    await settle();
    assert.equal(view.updates[0].images.filter(Boolean).length, 11);
    assert.equal(view.updates[0].failed, true);
    assert.ok(view.updates[0].images[11]);
});
