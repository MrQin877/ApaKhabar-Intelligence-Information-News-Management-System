import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const context = { exports: {} };
vm.runInNewContext(
    ts.transpileModule(readFileSync('resources/js/lib/video-crop.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    context,
);
const { cropRectangle, cropChanged } = context.exports;
const base = { x: 0.5, y: 0.5, zoom: 1, start: 0, end: 12 };

test('crop geometry preserves exact 9:16 and stays inside portrait, square and landscape sources', () => {
    for (const [width, height] of [
        [576, 1024],
        [1920, 1080],
        [1080, 1080],
    ]) {
        for (const zoom of [1, 1.75, 4])
            for (const x of [0, 0.5, 1])
                for (const y of [0, 0.5, 1]) {
                    const r = cropRectangle(width, height, {
                        ...base,
                        x,
                        y,
                        zoom,
                    });
                    assert.equal(r.width * 16, r.height * 9);
                    assert.ok(
                        r.x >= 0 &&
                            r.y >= 0 &&
                            r.x + r.width <= width &&
                            r.y + r.height <= height,
                    );
                    assert.equal(r.x % 2, 0);
                    assert.equal(r.y % 2, 0);
                }
    }
});
test('no-op detection ignores ineffective pan and detects crop, zoom and trim', () => {
    assert.equal(cropChanged(576, 1024, 12, base), false);
    assert.equal(cropChanged(576, 1024, 12, { ...base, x: 0, y: 1 }), false);
    assert.equal(cropChanged(1920, 1080, 12, base), true);
    assert.equal(cropChanged(576, 1024, 12, { ...base, zoom: 2 }), true);
    assert.equal(cropChanged(576, 1024, 12, { ...base, end: 10 }), true);
    assert.equal(
        cropChanged(576, 1024, 12, { ...base, zoom: 2 }, { ...base, zoom: 2 }),
        false,
    );
});
