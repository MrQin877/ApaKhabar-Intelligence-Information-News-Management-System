import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const richText = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../resources/js/lib/rich-text.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: richText });
const compiled = ts.transpileModule(
    readFileSync(
        new URL('../../resources/js/pages/short-viewer.tsx', import.meta.url),
        'utf8',
    ),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
        },
    },
).outputText;
const nodes = (node) =>
    !node || typeof node !== 'object'
        ? []
        : Array.isArray(node)
          ? node.flatMap(nodes)
          : [node, ...nodes(node.props?.children)];

function mount({ authenticated = true, likedByUser = false, width = 1280, reducedMotion = false, likeResponse } = {}) {
    const slots = [];
    const requests = [];
    const copied = [];
    const visits = [];
    let visitOptions;
    const timers = [];
    const effects = [];
    let measuredWidth = width;
    let resizeObserver;
    let remoteLiked = likedByUser;
    let cursor = 0;
    const context = {
        exports: {},
        URL,
        ResizeObserver: class {
            constructor(callback) {
                resizeObserver = callback;
            }
            observe() {
                resizeObserver();
            }
            disconnect() {}
        },
        window: {
            innerWidth: width,
            location: { origin: 'https://apakhabar.test' },
            matchMedia: () => ({ matches: reducedMotion }),
            setTimeout(callback) {
                timers.push(callback);

                return timers.length;
            },
            clearTimeout() {},
            requestAnimationFrame(callback) {
                callback();
            },
            cancelAnimationFrame() {},
        },
        navigator: {
            clipboard: {
                async writeText(value) {
                    copied.push(value);
                },
            },
        },
        require(name) {
            if (name === '@/lib/rich-text') return richText;
            if (name === 'react') {
                return {
                    useState(initial) {
                        const index = cursor++;

                        if (!(index in slots)) {
                            slots[index] =
                                typeof initial === 'function'
                                    ? initial()
                                    : initial;
                        }

                        return [
                            slots[index],
                            (value) => {
                                slots[index] =
                                    typeof value === 'function'
                                        ? value(slots[index])
                                        : value;
                            },
                        ];
                    },
                    useRef(initial) {
                        const index = cursor++;

                        return (slots[index] ??= { current: initial });
                    },
                    useEffect(callback) {
                        effects.push(callback);
                    },
                    useCallback(callback) {
                        return callback;
                    },
                };
            }

            if (name === '@inertiajs/react') {
                return {
                    Head: 'Head',
                    Link: 'Link',
                    router: {
                        visit(path, options) {
                            visits.push(path);
                            visitOptions = options;
                        },
                    },
                    usePage: () => ({
                        props: {
                            auth: { user: authenticated ? { id: 1 } : null },
                        },
                    }),
                };
            }

            if (name === '@/lib/meta-auth') {
                return {
                    async metaRequest(path) {
                        requests.push(path);
                        if (likeResponse) return likeResponse();
                        remoteLiked = !remoteLiked;

                        return {
                            liked: remoteLiked,
                            likes_count: remoteLiked ? 4 : 3,
                        };
                    },
                };
            }

            if (name === 'react/jsx-runtime') {
                return require(name);
            }

            return new Proxy({}, { get: (_, key) => String(key) });
        },
    };
    vm.runInNewContext(compiled, context);
    const props = {
        short: {
            id: 7,
            title: 'Video warga',
            description: 'Deskripsi',
            video_url: 'https://res.cloudinary.com/demo/video/upload/7.mp4',
            thumbnail_url: 'https://res.cloudinary.com/demo/image/upload/7.jpg',
            view_count: 12,
            likes_count: 3,
            published_at: '2026-10-20T12:00:00Z',
        },
        nextShortId: 8,
        nextShortPreview: { id: 8, title: 'Video berikutnya', thumbnail_url: '/next.jpg' },
        previousShortId: 6,
        commentCount: 2,
        likedByUser,
        canFlagComments: true,
    };
    const render = () => {
        cursor = 0;
        effects.length = 0;
        const page = context.exports.default(props);

        return nodes(page.type(page.props));
    };

    const resize = (value) => {
        measuredWidth = value;
        const main = render().find((node) => node.type === 'main');
        main.props.ref.current ??= {
            getBoundingClientRect: () => ({ width: measuredWidth }),
        };

        if (!resizeObserver) {
            effects.find((effect) => effect.toString().includes('ResizeObserver'))();
        } else {
            resizeObserver();
        }
    };

    const advance = () => {
        timers.shift()?.();
    };

    const switchShort = (id) => {
        slots.length = 0;
        props.short = {
            ...props.short,
            id,
            title: 'Video berikutnya',
            description: 'Kegiatan baru',
            view_count: 25,
            likes_count: 9,
            video_url: `https://res.cloudinary.com/demo/video/upload/${id}.mp4`,
        };
        props.commentCount = 5;
    };

    return {
        render, resize, advance, switchShort, requests, copied, visits,
        runAutoplay: () => effects.find((effect) => effect.toString().includes('NotAllowedError'))?.(),
        get visitOptions() {
            return visitOptions;
        },
    };
}

test('resizing while comments are open switches between full view and side panel', () => {
    const view = mount({ width: 800 });
    let current = view.render();
    current.find((node) => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.onClick();
    current = view.render();
    assert.equal(current.find((node) => node.type === 'ShortComments').props.fullScreen, true);

    view.resize(1000);
    current = view.render();
    assert.equal(current.find((node) => node.type === 'ShortComments').props.fullScreen, true);

    view.resize(1100);
    current = view.render();
    assert.equal(current.find((node) => node.type === 'ShortComments').props.fullScreen, false);
    assert.ok(current.some((node) => node.props?.style?.gridTemplateColumns?.includes('3.25rem minmax(0, 1fr)')));

    view.resize(800);
    current = view.render();
    assert.equal(current.find((node) => node.type === 'ShortComments').props.fullScreen, true);
});

test('next video slides out once and opens new comments without showing the previous thread', () => {
    const view = mount();
    let current = view.render();
    current.find((node) => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.onClick();
    current = view.render();
    let pauses = 0;
    current.find((node) => node.type === 'video').props.ref.current = {
        paused: false,
        pause() {
            pauses++;
        },
    };
    current.find((node) => node.props?.['aria-label'] === 'Video berikutnya').props.onClick();
    current.find((node) => node.props?.['aria-label'] === 'Video berikutnya').props.onClick();
    assert.equal(pauses, 1);
    current = view.render();
    assert.equal(current.find((node) => node.props?.['aria-label'] === 'Video berikutnya').props.disabled, true);
    assert.ok(current.some((node) => node.props?.className?.includes('-translate-y-[8%]')));
    view.advance();
    assert.deepEqual(view.visits, ['/shorts/8']);

    view.switchShort(8);
    current = view.render();
    assert.equal(current.find((node) => node.type === 'ShortComments').props.shortId, 8);
    assert.equal(current.find((node) => node.type === 'ShortComments').props.count, 5);
    assert.ok(current.some((node) => node.type === 'video' && node.props.src.endsWith('/8.mp4')));
    assert.ok(current.some((node) => node.type === 'button' && node.props.title === 'Video berikutnya'));
    assert.ok(current.some((node) => node.type === 'p' && node.props.children === 'Kegiatan baru'));
    assert.ok(current.some((node) => node.props?.['aria-label'] === 'Sukai video: 9 suka'));
    assert.ok(current.some((node) => node.props?.className?.includes('translate-y-[8%]')));
    assert.equal(current.find((node) => node.type === 'button' && node.props?.['aria-label'] === 'Video berikutnya').props.disabled, true);
});

test('comment button and panel X both close the panel without replacing the video', () => {
    const view = mount();
    let current = view.render();
    const videoRef = current.find((node) => node.type === 'video').props.ref;
    current.find((node) => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.onClick();
    current = view.render();
    assert.ok(current.find((node) => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.className.includes('border-primary/60'));
    current.find((node) => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.onClick();
    current = view.render();
    assert.ok(current.some((node) => node.props?.className?.includes('motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-right-4')));
    view.advance();
    current = view.render();
    assert.equal(current.filter((node) => node.type === 'ShortComments').length, 0);
    assert.equal(current.find((node) => node.type === 'video').props.ref, videoRef);

    current.find((node) => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.onClick();
    current = view.render();
    current.find((node) => node.type === 'ShortComments').props.onClose();
    current = view.render();
    assert.ok(current.some((node) => node.props?.className?.includes('motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-right-4')));
    view.advance();
    current = view.render();
    assert.equal(current.filter((node) => node.type === 'ShortComments').length, 0);
    assert.equal(current.find((node) => node.type === 'video').props.ref, videoRef);
});

test('reduced motion navigates immediately without an outgoing slide', () => {
    const view = mount({ reducedMotion: true });
    const current = view.render();
    current.find((node) => node.props?.['aria-label'] === 'Video berikutnya').props.onClick();
    assert.deepEqual(view.visits, ['/shorts/8']);
});

test('reduced motion closes comments without the fade-out delay', () => {
    const view = mount({ reducedMotion: true });
    let current = view.render();
    current.find((node) => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.onClick();
    current = view.render();
    current.find((node) => node.type === 'ShortComments').props.onClose();
    assert.equal(view.render().filter((node) => node.type === 'ShortComments').length, 0);
});

test('failed next-video navigation unlocks the control and restores playback', () => {
    const view = mount();
    let current = view.render();
    let plays = 0;
    current.find((node) => node.type === 'video').props.ref.current = {
        paused: false,
        pause() {},
        play() {
            plays++;

            return Promise.resolve();
        },
    };
    current.find((node) => node.props?.['aria-label'] === 'Video berikutnya').props.onClick();
    view.advance();
    view.visitOptions.onError();
    current = view.render();
    assert.equal(current.find((node) => node.type === 'button' && node.props?.['aria-label'] === 'Video berikutnya').props.disabled, false);
    assert.equal(plays, 1);
});

test('title opens details with real statistics and comments remain mutually exclusive', () => {
    const view = mount();
    let current = view.render();
    const videoRef = current.find((node) => node.type === 'video').props.ref;
    const title = current.find((node) => node.type === 'button' && node.props.title === 'Video warga');
    assert.ok(title.props.className.includes('break-words'));
    title.props.onClick();
    current = view.render();
    assert.ok(current.some((node) => node.props?.['aria-label'] === 'Detail video'));
    assert.equal(current.filter((node) => node.type === 'ShortComments').length, 0);
    assert.ok(current.some((node) => node.type === 'p' && node.props.children === 'Deskripsi'));
    current.find((node) => node.props?.['aria-label'] === 'Tutup detail video').props.onClick();
    current = view.render();
    current.find((node) => node.type === 'button' && node.props.children === 'Deskripsi').props.onClick();
    current = view.render();
    assert.ok(current.some((node) => node.props?.['aria-label'] === 'Detail video'));

    current.find((node) => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.onClick();
    current = view.render();
    assert.equal(current.filter((node) => node.props?.['aria-label'] === 'Detail video').length, 0);
    assert.equal(current.filter((node) => node.type === 'ShortComments').length, 1);
    assert.equal(current.find((node) => node.type === 'video').props.ref, videoRef);
});

test('top player controls, external engagement counts and muted state use the same player', () => {
    const view = mount();
    let current = view.render();
    const video = current.find((node) => node.type === 'video');
    video.props.ref.current = { muted: false, currentTime: 0 };
    assert.equal(video.props.controls, undefined);
    assert.ok(current.some((node) => node.props?.['aria-label'] === 'Posisi video'));
    assert.ok(current.some((node) => node.props?.['aria-label'] === 'Layar penuh'));
    current.find((node) => node.props?.['aria-label'] === 'Bisukan video').props.onClick();
    current = view.render();
    assert.equal(video.props.ref.current.muted, true);
    assert.ok(current.some((node) => node.props?.['aria-label'] === 'Bunyikan video'));
    const like = current.find((node) => node.props?.['aria-label'] === 'Sukai video: 3 suka');
    assert.equal(nodes(like).filter((node) => node.type === 'span').length, 0);
    assert.ok(current.some((node) => node.type === 'span' && node.props.children === 3));
});

test('mute preference applies before the next Short plays and follows later unmute', () => {
    const view = mount();
    let current = view.render();
    current.find((node) => node.type === 'video').props.ref.current = { muted: false };
    current.find((node) => node.props?.['aria-label'] === 'Bisukan video').props.onClick();
    view.switchShort(8);
    current = view.render();
    assert.equal(current.find((node) => node.type === 'video').props.muted, true);
    current.find((node) => node.type === 'video').props.ref.current = { muted: true };
    current.find((node) => node.props?.['aria-label'] === 'Bunyikan video').props.onClick();
    view.switchShort(9);
    current = view.render();
    assert.equal(current.find((node) => node.type === 'video').props.muted, false);
});

test('direct detail entry attempts playback and retries muted when autoplay is blocked', async () => {
    const view = mount();
    let current = view.render();
    const video = current.find((node) => node.type === 'video').props.ref;
    let plays = 0;
    let pauses = 0;
    video.current = {
        muted: false,
        play() {
            plays++;
            return plays === 1 ? Promise.reject({ name: 'NotAllowedError' }) : Promise.resolve();
        },
        pause() { pauses++; },
    };
    const cleanup = view.runAutoplay();
    await Promise.resolve();
    assert.equal(plays, 2);
    assert.equal(video.current.muted, true);
    current = view.render();
    assert.ok(current.some((node) => node.props?.['aria-label'] === 'Bunyikan video'));
    cleanup();
    assert.equal(pauses, 1);
});

test('narrow details use a Sheet and replace the player without losing its ref', () => {
    const view = mount({ width: 800 });
    let current = view.render();
    const videoRef = current.find((node) => node.type === 'video').props.ref;
    current.find((node) => node.type === 'button' && node.props.title === 'Video warga').props.onClick();
    current = view.render();
    assert.equal(current.find((node) => node.type === 'Sheet').props.open, true);
    assert.ok(current.some((node) => node.props?.className?.includes('row-start-2') && node.props.className.split(' ').includes('hidden')));
    current.find((node) => node.type === 'Sheet').props.onOpenChange(false);
    current = view.render();
    assert.equal(current.find((node) => node.type === 'Sheet').props.open, false);
    assert.equal(current.find((node) => node.type === 'video').props.ref, videoRef);
});

test('wheel navigation advances once and preserves the active details panel', () => {
    const view = mount();
    let current = view.render();
    current.find((node) => node.type === 'button' && node.props.title === 'Video warga').props.onClick();
    current = view.render();
    const main = current.find((node) => node.type === 'main');
    let prevented = 0;
    const wheel = { deltaY: 110, target: { closest: () => null }, preventDefault: () => prevented++ };
    main.props.onWheel(wheel);
    main.props.onWheel(wheel);
    assert.equal(prevented, 2);
    view.advance();
    assert.deepEqual(view.visits, ['/shorts/8']);
    view.switchShort(8);
    current = view.render();
    assert.ok(current.some((node) => node.props?.['aria-label'] === 'Detail video'));
    assert.ok(current.some((node) => node.type === 'button' && node.props.title === 'Video berikutnya'));
    current.find((node) => node.type === 'main').props.onWheel(wheel);
    view.advance();
    assert.deepEqual(view.visits, ['/shorts/8']);
});

test('short browser heights keep internal wheel scrolling available', () => {
    const view = mount();
    const main = view.render().find((node) => node.type === 'main');
    main.props.ref.current = { scrollHeight: 900, clientHeight: 600 };
    let prevented = false;
    main.props.onWheel({
        deltaY: 100,
        target: { closest: () => null },
        preventDefault: () => {
            prevented = true;
        },
    });
    view.advance();
    assert.equal(prevented, false);
    assert.deepEqual(view.visits, []);
});

test('viewer centers the selected Short with one next-video control and an independent comment panel', () => {
    const view = mount();
    let current = view.render();
    assert.ok(current.find((node) => node.type === 'main').props.className.includes('h-[calc(100dvh-65px)]'));
    assert.ok(current.find((node) => node.type === 'main').props.className.includes('overflow-y-auto'));
    assert.equal(current.find((node) => node.props?.className?.includes('aspect-[9/16]')).props.style.width, '100%');
    const player = current.find((node) => node.props?.className?.includes('aspect-[9/16]'));
    assert.equal(nodes(player).filter((node) => node.type === 'button' && node.props.title === 'Video warga').length, 0);
    const heading = current.find((node) => node.type === 'button' && node.props.title === 'Video warga');
    assert.ok(heading.props.className.includes('break-words'));
    assert.ok(heading.props.className.includes('font-bold'));
    assert.ok(current.some((node) => node.props?.className?.includes('col-start-2 row-start-1') && node.props.className.includes('mb-8')));
    assert.ok(current.some((node) => node.props?.className?.includes('col-start-4 row-start-1') && node.props.className.includes('mb-8')));
    const shareGroup = current.find((node) => node.type === 'div' && Array.isArray(node.props?.children) && node.props.children.some((child) => child?.props?.['aria-label'] === 'Bagikan video'));
    assert.equal(shareGroup.props.className, 'flex flex-col items-center gap-1');
    assert.equal(shareGroup.props.children.find((child) => child?.type === 'span').props.className, 'text-xs');
    assert.ok(current.some((node) => node.type === 'img' && node.props.src === '/next.jpg'));
    assert.ok(current.some((node) => node.props?.['aria-label'] === 'Posisi video' && node.props?.className?.includes('accent-primary')));
    assert.ok(
        current.some(
            (node) =>
                node.type === 'video' && node.props.src.endsWith('/7.mp4'),
        ),
    );
    assert.equal(
        current.filter((node) => node.type === 'ShortComments').length,
        0,
    );
    const columns = current.find((node) => node.props?.style?.gridTemplateColumns).props.style.gridTemplateColumns;
    assert.ok(columns.startsWith('3.25rem minmax(0, 1fr)'));
    assert.ok(columns.endsWith('3.25rem minmax(0, 1fr)'));
    assert.equal(
        current.filter(
            (node) => node.props?.['aria-label'] === 'Video berikutnya',
        ).length,
        1,
    );
    assert.equal(
        current.find(
            (node) => node.props?.['aria-label'] === 'Video berikutnya',
        ).props.type,
        'button',
    );
    assert.ok(current.some((node) => node.type === 'TooltipContent'));
    assert.equal(
        current.filter((node) => node.type === 'DropdownMenu').length,
        0,
    );
    assert.ok(
        current.some(
            (node) =>
                node.type === 'video' &&
                node.props['aria-label'] === 'Video warga',
        ),
    );

    current
        .find(
            (node) =>
                node.props?.['aria-label'] === 'Buka komentar: 2 komentar',
        )
        .props.onClick();
    current = view.render();
    assert.equal(current.find((node) => node.props?.style?.gridTemplateColumns).props.style.gridTemplateColumns, columns);
    const panel = current.find((node) => node.props?.className?.includes('col-start-5 row-start-1') && node.props.className.includes('self-stretch'));
    const title = current.find((node) => node.props?.className?.includes('max-w-[400px] motion-safe:animate-in'));
    assert.ok(panel.props.className.includes('motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4'));
    assert.ok(panel.props.className.includes('motion-safe:duration-500 motion-safe:ease-in-out'));
    assert.ok(title.props.className.includes('motion-safe:duration-500 motion-safe:ease-in-out'));
    assert.ok(
        current.some(
            (node) =>
                node.type === 'video' && node.props.src.endsWith('/7.mp4'),
        ),
    );
    assert.equal(
        current.filter((node) => node.type === 'ShortComments').length,
        1,
    );
    assert.equal(
        current.find(
            (node) => node.props?.['aria-label'] === 'Video berikutnya',
        ).props.type,
        'button',
    );
    assert.equal(
        current.filter(
            (node) => node.props?.['aria-label'] === 'Video berikutnya',
        ).length,
        1,
    );
    current.find((node) => node.type === 'ShortComments').props.onClose();
    current = view.render();
    view.advance();
    current = view.render();
    assert.equal(
        current.filter((node) => node.type === 'ShortComments').length,
        0,
    );
    assert.equal(current.find((node) => node.props?.style?.gridTemplateColumns).props.style.gridTemplateColumns, columns);
});

test('desktop grid balances the action rail at common widths and zoomed viewports', () => {
    const view = mount();
    const current = view.render();
    const columns = current.find((node) => node.props?.style?.gridTemplateColumns).props.style.gridTemplateColumns;
    assert.match(columns, /^3\.25rem minmax\(0, 1fr\) min\(.+\) 3\.25rem minmax\(0, 1fr\)$/);
    assert.ok(current.find((node) => node.type === 'main').props.className.includes('mx-auto'));
    assert.ok(current.find((node) => node.type === 'main').props.className.includes('max-w-7xl'));
    assert.equal(-(52 + 20) / 2, -36);
    for (const viewport of [1080, 1366, 1920, 2005, 1604, 1337]) {
        const content = Math.min(viewport, 1280) - 48;
        const video = Math.min(460, Math.max(180, 0.5625 * 768 - 140), viewport - 704);
        const side = (content - video - 2 * 52 - 4 * 20) / 2;
        const center = (viewport - content) / 2 + 52 + 20 + side + 20 + video / 2;
        assert.equal(center, viewport / 2);
    }
});

test('mobile places readable text below the video and actions beside it', () => {
    const current = mount({ width: 390 }).render();
    assert.ok(current.some((node) => node.props?.className?.includes('col-start-1 row-start-2 pt-2')));
    assert.ok(current.some((node) => node.props?.className?.includes('col-start-2 row-start-1')));
    assert.equal(current.filter((node) => node.props?.['aria-label'] === 'Video berikutnya').length, 1);
});

for (const width of [800, 390]) {
    test(`${width}px viewer replaces the player with full-height comments and restores it on close`, () => {
        const view = mount({ width });
        let current = view.render();
        const videoRef = current.find((node) => node.type === 'video').props.ref;
        assert.ok(current.some((node) => node.props?.style?.gridTemplateColumns?.endsWith('3.25rem')));
        assert.ok(current.some((node) => node.props?.['aria-label'] === 'Video berikutnya'));

        current.find((node) => node.props?.['aria-label'] === 'Buka komentar: 2 komentar').props.onClick();
        current = view.render();
        assert.ok(current.some((node) => node.type === 'ShortComments' && node.props.fullScreen === true));
        assert.ok(current.some((node) => node.props?.className?.includes('fixed inset-x-0 z-50')));
        assert.ok(current.some((node) => node.type === 'video' && node.props.src.endsWith('/7.mp4')));
        assert.equal(current.find((node) => node.type === 'video').props.ref, videoRef);
        assert.ok(current.some((node) => node.props?.className?.includes('row-start-1') && node.props.className.split(' ').includes('hidden')));
        assert.ok(current.some((node) => node.props?.className?.includes('self-center justify-self-center') && node.props.className.includes('hidden')));

        current.find((node) => node.type === 'ShortComments').props.onClose();
        current = view.render();
        assert.ok(current.some((node) => node.props?.className?.includes('motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-right-4')));
        view.advance();
        current = view.render();
        assert.equal(current.filter((node) => node.type === 'ShortComments').length, 0);
        assert.ok(current.some((node) => node.props?.['aria-label'] === 'Video berikutnya'));
        assert.equal(current.find((node) => node.type === 'video').props.ref, videoRef);
    });
}

test('mobile swipe navigates to adjacent published Shorts and tap toggles playback', () => {
    const view = mount({ width: 390 });
    const current = view.render();
    const player = current.find((node) => node.type === 'video').props.ref;
    let played = 0;
    let paused = 0;
    player.current = {
        paused: true,
        currentTime: 12,
        play() {
            played++;
            this.paused = false;

            return Promise.resolve();
        },
        pause() {
            paused++;
            this.paused = true;
        },
    };
    const tap = current.find((node) => node.props?.['aria-label'] === 'Putar atau jeda video');
    tap.props.onClick();
    tap.props.onClick();
    assert.equal(played, 1);
    assert.equal(paused, 1);
    assert.equal(player.current.currentTime, 12);

    const surface = current.find((node) => node.props?.className?.includes('aspect-[9/16]'));
    surface.props.onTouchStart({ touches: [{ clientX: 50, clientY: 200 }] });
    surface.props.onTouchEnd({ changedTouches: [{ clientX: 55, clientY: 100 }] });
    surface.props.onTouchStart({ touches: [{ clientX: 50, clientY: 100 }] });
    surface.props.onTouchEnd({ changedTouches: [{ clientX: 55, clientY: 200 }] });
    view.advance();
    assert.deepEqual(view.visits, ['/shorts/8']);
});

test('like toggles backend count and red state with a restartable pop animation', async () => {
    const view = mount();
    let current = view.render();
    await current
        .find((node) => node.props?.['aria-label'] === 'Sukai video: 3 suka')
        .props.onClick();
    await new Promise(setImmediate);
    current = view.render();
    assert.equal(
        current.find((node) => node.props?.['aria-label'] === 'Batal menyukai video: 4 suka').props['aria-pressed'],
        true,
    );
    const likedHeart = current.find(
        (node) => node.type === 'Heart' && node.props?.className?.includes('short-like-pop'),
    );
    assert.ok(likedHeart.props.className.includes('text-red-500'));
    assert.equal(likedHeart.props.fill, 'currentColor');
    const animationKey = likedHeart.key;
    await current
        .find((node) => node.props?.['aria-label'] === 'Batal menyukai video: 4 suka')
        .props.onClick();
    await new Promise(setImmediate);
    current = view.render();
    const unlikedHeart = current.find(
        (node) => node.type === 'Heart' && node.props?.className?.includes('short-like-pop'),
    );
    assert.notEqual(unlikedHeart.key, animationKey);
    assert.equal(unlikedHeart.props.fill, 'none');
    assert.ok(
        !unlikedHeart.props.className.includes('text-red-500'),
    );
    assert.deepEqual(view.requests, ['/shorts/7/like', '/shorts/7/like']);
});

for (const initiallyLiked of [false, true]) {
    test(`like updates immediately, locks rapid clicks and rolls back failure (${initiallyLiked})`, async () => {
        let reject;
        const view = mount({ likedByUser: initiallyLiked, likeResponse: () => new Promise((_, fail) => { reject = fail; }) });
        const button = view.render().find(node => node.props?.['aria-label']?.endsWith('video: 3 suka'));
        button.props.onClick();
        button.props.onClick();
        let current = view.render();
        const expectedCount = initiallyLiked ? 2 : 4;
        const optimistic = current.find(node => node.props?.['aria-label']?.endsWith(`video: ${expectedCount} suka`));
        assert.equal(optimistic.props['aria-pressed'], !initiallyLiked);
        assert.equal(optimistic.props.disabled, true);
        assert.equal(view.requests.length, 1);
        reject(new Error('Request failed'));
        await new Promise(setImmediate);
        current = view.render();
        const restored = current.find(node => node.props?.['aria-label']?.endsWith('video: 3 suka'));
        assert.equal(restored.props['aria-pressed'], initiallyLiked);
        assert.equal(restored.props.disabled, false);
        assert.ok(current.some(node => node.props?.children === 'Request failed'));
    });
}

test('share copies the selected Short URL and shows success feedback', async () => {
    const view = mount();
    let current = view.render();
    await current
        .find((node) => node.props?.['aria-label'] === 'Bagikan video')
        .props.onClick();
    await new Promise(setImmediate);
    current = view.render();
    assert.deepEqual(view.copied, ['https://apakhabar.test/shorts/7']);
    assert.ok(current.some((node) => node.props?.children === 'Tautan berhasil disalin!'));
});

test('guests see the login dialog instead of sending a like request', async () => {
    const view = mount({ authenticated: false });
    let current = view.render();
    await current
        .find((node) => node.props?.['aria-label'] === 'Sukai video: 3 suka')
        .props.onClick();
    current = view.render();
    assert.deepEqual(view.requests, []);
    assert.equal(current.find((node) => node.type === 'Dialog').props.open, true);
});
