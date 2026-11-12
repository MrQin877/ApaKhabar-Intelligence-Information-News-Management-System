import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(
    readFileSync(new URL('../../resources/js/components/short-comments.tsx', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const nodes = (node) =>
    !node || typeof node !== 'object'
        ? []
        : Array.isArray(node)
          ? node.flatMap(nodes)
          : [node, ...nodes(node.props?.children)];

function mount(canFlag, { authenticated = true, failContext = false, failComments = false } = {}) {
    const slots = [];
    const posts = [];
    let cursor = 0;
    let initialized = false;
    const context = {
        exports: {},
        require(name) {
            if (name === 'react') {
                return {
                    useState(initial) {
                        const index = cursor++;

                        if (!(index in slots)) {
                            slots[index] = initial;
                        }

                        return [slots[index], (value) => {
                            slots[index] = typeof value === 'function' ? value(slots[index]) : value;
                        }];
                    },
                    useRef(initial) {
                        const index = cursor++;

                        return (slots[index] ??= { current: initial });
                    },
                    useEffect(callback) {
                        if (!initialized) {
                            initialized = true;
                            callback();
                        }
                    },
                };
            }

            if (name === 'react/jsx-runtime') {
                return require(name);
            }

            if (name === '@/lib/meta-auth') {
                return {
                    metaRequest(path) {
                        if (path.endsWith('/engagement')) {
                            if (failContext) return Promise.reject(new Error('Challenge unavailable'));
                            return Promise.resolve({ challenge: 'challenge' });
                        }
                        if (failComments) return Promise.reject(new Error('Comments unavailable'));

                        return Promise.resolve({
                            comments: {
                                data: [{
                                    id: '11', author: 'Warga', avatar: null,
                                    content: 'Komentar warga', date: '5 jam lalu',
                                    likes_count: 2, liked_by_user: false,
                                    reported_by_user: false, replies_count: 3,
                                }],
                                current_page: 1, last_page: 1,
                            },
                            count: 1,
                        });
                    },
                };
            }

            if (name === '@/components/news-engagement') {
                return {
                    async engagementPost(path, data) {
                        posts.push({ path, data });

                        return { message: 'Laporan diterima.' };
                    },
                };
            }

            if (name === '@/lib/comment-moderation-options') {
                return {
                    reportCategories: ['Spam'],
                    adminFlagReasons: [['spam', 'Spam']],
                };
            }

            return new Proxy({}, { get: (_, key) => String(key) });
        },
    };
    vm.runInNewContext(compiled, context);
    const render = () => {
        cursor = 0;

        return nodes(context.exports.ShortComments({
            shortId: 7, authenticated, canFlag, count: 1,
            onCountChange() {}, onClose() {}, onLogin() {},
        }));
    };

    return { render, posts };
}

test('guest challenge failure does not hide published comments or disable registered submissions', async () => {
    const view = mount(false, { failContext: true });
    view.render();
    await new Promise(setImmediate);
    let current = view.render();
    assert.ok(current.some(node => JSON.stringify(node.props?.children)?.includes('Komentar warga')));
    current.find(node => node.props?.id === 'short-comment-content').props.onChange({ target: { value: 'Komentar baru' } });
    current = view.render();
    assert.equal(current.find(node => node.props?.children === 'Kirim Komentar').props.disabled, false);
});

test('guest can retry a failed challenge while still viewing comments', async () => {
    const view = mount(false, { authenticated: false, failContext: true });
    view.render();
    await new Promise(setImmediate);
    const current = view.render();
    assert.ok(current.some(node => JSON.stringify(node.props?.children)?.includes('Komentar warga')));
    assert.ok(current.some(node => node.props?.children === 'Muat ulang komentar'));
    assert.equal(current.find(node => node.props?.children === 'Kirim Komentar').props.disabled, true);
});

test('a failed list request does not lose the guest submission challenge', async () => {
    const view = mount(false, { authenticated: false, failComments: true });
    view.render();
    await new Promise(setImmediate);
    let current = view.render();
    current.find(node => node.props?.id === 'short-comment-content').props.onChange({ target: { value: 'Komentar tamu' } });
    current = view.render();
    assert.equal(current.find(node => node.props?.children === 'Kirim Komentar').props.disabled, false);
    await current.find(node => node.type === 'form' && node.props.className?.includes('border-t')).props.onSubmit({ preventDefault() {} });
    assert.equal(view.posts[0].path, '/shorts/7/comments');
    assert.equal(view.posts[0].data.challenge, 'challenge');
});

for (const canFlag of [false, true]) {
    test(`${canFlag ? 'moderator flag' : 'user report'} uses the News-style comment card and correct endpoint`, async () => {
        const view = mount(canFlag);
        view.render();
        await new Promise(setImmediate);
        let current = view.render();
        assert.ok(current.some((node) => node.type === 'Avatar' && node.props.className.includes('size-8')));
        assert.ok(current.some((node) => node.type === 'p' && JSON.stringify(node.props.children).includes('Komentar warga')));
        assert.ok(current.some((node) => node.type === 'span' && node.props.children === '5 jam lalu'));
        assert.ok(current.some((node) => node.type === 'button' && node.props['aria-label'] === 'Sukai komentar: 2 suka'));
        assert.ok(current.some((node) => node.type === 'button' && node.props.children === 'Balas'));
        assert.ok(current.some((node) => node.type === 'button' && node.props.children === 'Lihat balasan (3)'));

        const report = current.find((node) =>
            node.type === 'button' &&
            node.props.className?.includes('group-hover/comment:opacity-100'),
        );
        assert.ok(report.props.className.includes('[@media(hover:hover)]:opacity-0'));
        assert.equal(report.props.children.at(-1), canFlag ? 'Tandai Admin' : 'Laporkan');
        report.props.onClick();
        current = view.render();
        assert.equal(current.find((node) => node.type === 'Dialog').props.open, true);

        current.find((node) => node.type === 'select').props.onChange({ target: { value: canFlag ? 'spam' : 'Spam' } });
        current = view.render();
        const form = current.find((node) => node.type === 'form' && nodes(node).some((child) => child.type === 'select'));
        form.props.onSubmit({ preventDefault() {} });
        await new Promise(setImmediate);
        assert.equal(view.posts.length, 1);
        assert.equal(view.posts[0].path, `/shorts/7/comments/11/${canFlag ? 'flag' : 'report'}`);
        assert.equal(view.posts[0].data.category, canFlag ? 'spam' : 'Spam');
    });
}

test('desktop comments fill the video-height slot and scroll only the list', () => {
    const current = mount(false).render();
    const panel = current.find((node) => node.type === 'section' && node.props?.['aria-label'] === 'Komentar video pendek');
    assert.ok(panel.props.className.includes('h-full min-h-0'));
    assert.equal(panel.props.style, undefined);
    assert.ok(current.find((node) => node.type === 'header').props.className.includes('shrink-0'));
    assert.ok(current.find((node) => node.props?.['aria-busy'] !== undefined).props.className.includes('flex-1 space-y-3 overflow-y-auto'));
    assert.ok(current.find((node) => node.type === 'form').props.className.includes('shrink-0'));
});
