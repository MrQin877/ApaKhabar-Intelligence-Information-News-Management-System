import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    hasManualContent,
    saveManualDraft,
} from '../../resources/js/lib/manual-draft.ts';
import {
    installNavigationGuard,
    setNavigationGuard,
} from '../../resources/js/lib/navigation-guard.ts';

const empty = {
    headline: '',
    content: '',
    image: '',
    cover_photo: null,
    category_id: '',
};

test('empty editor markup does not warn, but every content field and inserted images do', () => {
    for (const content of ['', '<p><br></p>', '<div>&nbsp; </div>'])
        assert.equal(hasManualContent({ ...empty, content }), false);
    for (const change of [
        { headline: 'Judul' },
        { content: '<p>Halo</p>' },
        { content: '<img src="/storage/news-images/photo.png">' },
        { category_id: '3' },
        { image: 'https://example.com/a.jpg' },
        { cover_photo: new File(['image'], 'cover.png') },
    ])
        assert.equal(hasManualContent({ ...empty, ...change }), true);
});

test('draft request preserves fields and uploads and updates the same ID without publishing', async () => {
    const originalFetch = globalThis.fetch;
    const originalDocument = globalThis.document;
    globalThis.document = {
        cookie: 'XSRF-TOKEN=token',
        querySelector: () => null,
    };
    const cover = new File(['bytes'], 'cover.png', { type: 'image/png' });
    const crops = { instagram: { type: 'portrait', x: 0.5, y: 0.5, zoom: 1 } };
    globalThis.fetch = async (url, options) => {
        assert.equal(url, '/admin/news/manual/42');
        assert.equal(options.body.get('_method'), 'put');
        assert.equal(options.body.get('intent'), 'draft');
        assert.equal(options.body.has('platforms'), false);
        assert.equal(options.body.get('headline'), 'Judul');
        assert.equal(options.body.get('content'), '<p>Isi</p>');
        assert.deepEqual(JSON.parse(options.body.get('image_crops')), crops);
        assert.equal(await options.body.get('cover_photo').text(), 'bytes');
        assert.equal(options.headers['X-XSRF-TOKEN'], 'token');
        return { ok: true, json: async () => ({ draft: { id: 42 } }) };
    };
    try {
        const saved = await saveManualDraft(
            {
                ...empty,
                headline: 'Judul',
                content: '<p>Isi</p>',
                cover_photo: cover,
                image_crops: crops,
                platforms: ['website', 'instagram'],
            },
            42,
        );
        assert.equal(saved.id, 42);
        globalThis.fetch = async () => ({
            ok: false,
            json: async () => ({
                errors: { cover_photo: ['Gambar gagal disimpan.'] },
            }),
        });
        await assert.rejects(
            () => saveManualDraft(empty),
            /Gambar gagal disimpan/,
        );
    } finally {
        globalThis.fetch = originalFetch;
        globalThis.document = originalDocument;
    }
});

function browserHistory() {
    const entries = [{ state: { page: 'list' }, url: '/admin/news' }];
    let index = 0;
    const listeners = [];
    const delivered = [];
    const win = {
        history: {
            get state() {
                return entries[index].state;
            },
            pushState(state, unused, url) {
                entries.splice(index + 1);
                entries.push({ state, url });
                index++;
            },
            replaceState(state, unused, url) {
                entries[index] = { state, url: url ?? entries[index].url };
            },
            go(delta) {
                index += delta;
                assert.ok(index >= 0 && index < entries.length);
                let stopped = false;
                const event = {
                    state: entries[index].state,
                    stopImmediatePropagation() {
                        stopped = true;
                    },
                };
                for (const listener of listeners) listener(event);
                if (!stopped) delivered.push(entries[index].url);
            },
        },
        addEventListener(name, listener) {
            assert.equal(name, 'popstate');
            listeners.push(listener);
        },
    };
    return { win, entries, delivered, current: () => entries[index].url };
}

test('back restores the editor before asking; continue editing and confirmed leave preserve intended destination', () => {
    const browser = browserHistory();
    installNavigationGuard(browser.win);
    browser.win.history.pushState(
        { page: 'editor' },
        '',
        '/admin/news/manual/create',
    );
    browser.win.history.replaceState(
        { page: 'editor', rememberedState: {} },
        '',
    );
    let dirty = true;
    let proceed;
    const remove = setNavigationGuard({
        blocked: () => dirty,
        ask: (next) => {
            assert.equal(browser.current(), '/admin/news/manual/create');
            proceed = next;
        },
    });
    browser.win.history.go(-1);
    assert.equal(browser.current(), '/admin/news/manual/create');
    assert.deepEqual(browser.delivered, []);
    assert.equal(browser.entries.length, 2);
    // Continuing simply drops the pending action, preserving editor/history.
    proceed = undefined;
    browser.win.history.go(-1);
    dirty = false; // Successful save or explicit discard.
    proceed();
    assert.equal(browser.current(), '/admin/news');
    assert.deepEqual(browser.delivered, ['/admin/news']);
    remove();
});

test('forward and multi-entry traversal return to the exact requested destination', () => {
    const browser = browserHistory();
    installNavigationGuard(browser.win);
    browser.win.history.pushState({ page: 'editor' }, '', '/editor');
    browser.win.history.pushState({ page: 'other' }, '', '/other');
    browser.win.history.go(-1);
    let dirty = true;
    let proceed;
    const remove = setNavigationGuard({
        blocked: () => dirty,
        ask: (next) => {
            proceed = next;
        },
    });
    browser.win.history.go(1);
    assert.equal(browser.current(), '/editor');
    dirty = false;
    proceed();
    assert.equal(browser.current(), '/other');
    dirty = true;
    browser.win.history.go(-2);
    assert.equal(browser.current(), '/other');
    dirty = false;
    proceed();
    assert.equal(browser.current(), '/admin/news');
    remove();
});
