import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { publishManual } from '../../resources/js/lib/manual-publish.ts';

const originalFetch = globalThis.fetch;
beforeEach(() => {
    globalThis.document = {
        cookie: 'XSRF-TOKEN=test%20token',
        querySelector: () => null,
    };
});
afterEach(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.document;
});

test('waits for a slow final result and sends only one multipart request', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let finish;
    let calls = 0;
    const body = new FormData();
    body.append('intent', 'publish');
    globalThis.fetch = async (_path, options) => {
        calls++;
        assert.equal(options.body, body);
        assert.equal(options.headers.Accept, 'application/json');
        assert.equal(options.headers['X-XSRF-TOKEN'], 'test token');
        assert.equal(options.headers['X-Inertia'], undefined);
        return new Promise((resolve) => {
            finish = resolve;
        });
    };
    let completed = false;
    const pending = publishManual('/admin/news/manual', body, [
        'website',
        'facebook',
        'instagram',
    ]).then((result) => {
        completed = true;
        return result;
    });
    t.mock.timers.tick(4 * 60 * 1000);
    await Promise.resolve();
    assert.equal(completed, false);
    finish(
        Response.json({
            attempt_id: 'final',
            results: {
                application: { success: true },
                facebook: { success: true },
                instagram: { success: false, message: 'Media rejected' },
            },
        }),
    );
    const result = await pending;
    assert.equal(result.success, false);
    assert.equal(result.results.application.success, true);
    assert.equal(result.results.facebook.success, true);
    assert.equal(result.results.instagram.message, 'Media rejected');
    assert.equal(result.completion_url, '/admin/news');
    assert.equal(calls, 1);
});

test('timeout settles with per-platform failures and never retries', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let calls = 0;
    globalThis.fetch = (_path, { signal }) => {
        calls++;
        return new Promise((_resolve, reject) =>
            signal.addEventListener('abort', () =>
                reject(new Error('aborted')),
            ),
        );
    };
    const pending = publishManual('/admin/news/manual', new FormData(), [
        'website',
        'instagram',
    ]);
    t.mock.timers.tick(5 * 60 * 1000);
    const result = await pending;
    assert.equal(result.success, false);
    assert.equal(result.results.application.success, false);
    assert.match(result.results.instagram.message, /masih berjalan/);
    assert.equal(calls, 1);
});

test('network and non-JSON gateway errors produce completion results', async () => {
    for (const failure of [
        () => Promise.reject(new Error('offline')),
        () => Promise.resolve(new Response('Gateway timeout', { status: 504 })),
    ]) {
        globalThis.fetch = failure;
        const result = await publishManual(
            '/admin/news/manual',
            new FormData(),
            ['website', 'facebook'],
        );
        assert.equal(result.success, false);
        assert.deepEqual(Object.keys(result.results), [
            'application',
            'facebook',
        ]);
        assert.equal(result.completion_url, '/admin/news');
    }
});

test('preserves final results on an error response and marks missing platforms failed', async () => {
    globalThis.fetch = async () =>
        Response.json(
            { results: { application: { success: true } } },
            { status: 500 },
        );
    const result = await publishManual('/admin/news/manual', new FormData(), [
        'website',
        'facebook',
    ]);
    assert.equal(result.results.application.success, true);
    assert.equal(result.results.facebook.success, false);
});

test('all successful platforms produce success', async () => {
    globalThis.fetch = async () =>
        Response.json({
            results: {
                application: { success: true },
                facebook: { success: true },
            },
        });
    const result = await publishManual('/admin/news/manual', new FormData(), [
        'website',
        'facebook',
    ]);
    assert.equal(result.success, true);
});
