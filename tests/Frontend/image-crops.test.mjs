import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import {
    cropRectangle,
    defaultCrops,
    updateCrop,
    imageOrientation,
    initializeCrops,
    cropSpec,
} from '../../resources/js/lib/image-crops.ts';

test('orientation tolerance and social output dimensions', () => {
    for (const [width, height, type, ig, fb] of [
        [1080, 1350, 'portrait', [1080, 1350], [1080, 1350]],
        [1080, 1080, 'square', [1080, 1080], [1080, 1080]],
        [1920, 1080, 'landscape', [1080, 566], [1200, 630]],
    ]) {
        assert.equal(imageOrientation(width, height), type);
        const crops = initializeCrops(defaultCrops(), width, height);
        for (const [platform, dimensions] of [
            ['instagram', ig],
            ['facebook', fb],
        ]) {
            const spec = cropSpec(platform, crops[platform]);
            assert.deepEqual([spec.width, spec.height], dimensions);
            assert.equal(crops[platform].x, 0.5);
            assert.equal(crops[platform].zoom, 1);
        }
        assert.deepEqual(crops.website, defaultCrops().website);
    }
    for (const width of [900, 999, 1001, 1100])
        assert.equal(imageOrientation(width, 1000), 'square');
    assert.equal(imageOrientation(899, 1000), 'portrait');
    assert.equal(imageOrientation(1101, 1000), 'landscape');
});

test('saved type and manual focus survive initialization and synchronized zoom edits', () => {
    const crops = initializeCrops(defaultCrops(), 1080, 1350);
    const edited = updateCrop(crops, 'instagram', {
        ...crops.instagram,
        x: 0.8,
        y: 0.2,
        zoom: 2.5,
    });
    assert.deepEqual(initializeCrops(edited, 1920, 1080), edited);
    assert.equal(edited.facebook.type, 'portrait');
    assert.equal(edited.facebook.zoom, 1);
    assert.equal(edited.facebook.x, 0.8);
});

test('actual PHP crop calculation matches preview for every type, platform, zoom and edge', () => {
    const fixtures = [];
    for (const [width, height] of [
        [1080, 1350],
        [1080, 1080],
        [1920, 1080],
        [601, 799],
        [1, 1],
    ]) {
        for (const platform of ['website', 'instagram', 'facebook']) {
            for (const type of ['portrait', 'square', 'landscape']) {
                for (const x of [0, 0.5, 1]) {
                    for (const zoom of [1, 2.25, 4])
                        fixtures.push([
                            width,
                            height,
                            platform,
                            { type, x, y: 1 - x, zoom },
                        ]);
                }
            }
        }
    }
    const actual = JSON.parse(
        execFileSync(
            'php',
            [
                '-r',
                `require 'vendor/autoload.php'; $fixtures=json_decode(stream_get_contents(STDIN), true); echo json_encode(array_map(fn($f) => App\\Services\\NewsImageCropService::cropRectangle(...$f), $fixtures));`,
            ],
            { input: JSON.stringify(fixtures), encoding: 'utf8' },
        ),
    );
    assert.deepEqual(
        actual,
        fixtures.map((fixture) => cropRectangle(...fixture)),
    );
});

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
