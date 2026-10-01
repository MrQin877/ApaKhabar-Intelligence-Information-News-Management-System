import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    cropRectangle,
    defaultCrops,
    updateCrop,
} from '../../resources/js/lib/image-crops.ts';

test('synchronized edits share focal point but preserve each zoom', () => {
    const original = defaultCrops();
    const result = updateCrop(original, 'instagram', {
        x: 0.8,
        y: 0.2,
        zoom: 3,
    });
    assert.deepEqual(result.website, { x: 0.8, y: 0.2, zoom: 1 });
    assert.deepEqual(result.facebook, result.website);
    assert.equal(result.instagram.zoom, 3);
    assert.equal(original.website.x, 0.5);
});
test('independent edits do not change other platforms', () => {
    const original = { ...defaultCrops(), sync: false };
    const result = updateCrop(original, 'facebook', {
        x: 0.1,
        y: 0.9,
        zoom: 4,
    });
    assert.deepEqual(result.website, original.website);
    assert.deepEqual(result.instagram, original.instagram);
    assert.equal(result.facebook.zoom, 4);
});
test('preview source rectangles match server crop fixtures', () => {
    assert.deepEqual(
        cropRectangle(400, 200, 'website', { x: 0, y: 0.5, zoom: 4 }),
        { width: 89, height: 50, x: 0, y: 75 },
    );
    assert.deepEqual(
        cropRectangle(400, 200, 'instagram', { x: 1, y: 0.5, zoom: 4 }),
        { width: 50, height: 50, x: 350, y: 75 },
    );
});
test('all aspect ratios stay inside portrait and landscape source boundaries', () => {
    for (const [width, height] of [
        [4000, 300],
        [300, 4000],
        [601, 799],
        [1, 1],
    ]) {
        for (const platform of ['website', 'instagram', 'facebook']) {
            for (const x of [0, 0.5, 1]) {
                for (const zoom of [1, 2.25, 4]) {
                    const crop = cropRectangle(width, height, platform, {
                        x,
                        y: 1 - x,
                        zoom,
                    });
                    assert.ok(crop.x >= 0 && crop.y >= 0);
                    assert.ok(
                        crop.x + crop.width <= width &&
                            crop.y + crop.height <= height,
                    );
                }
            }
        }
    }
});
