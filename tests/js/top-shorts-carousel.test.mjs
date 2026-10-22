import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(
    new URL(
        '../../resources/js/components/top-shorts-carousel.tsx',
        import.meta.url,
    ),
    'utf8',
);
const compiled = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
    },
}).outputText;
const nodes = (node) =>
    !node || typeof node !== 'object'
        ? []
        : Array.isArray(node)
          ? node.flatMap(nodes)
          : [node, ...nodes(node.props?.children)];

function mount(shorts, reducedMotion = false) {
    const slots = [];
    let cursor = 0;
    let effect;
    let tick;
    let cleanup;
    let intervalDelay;
    let clock = 0;
    const context = {
        exports: {},
        document: {
            hidden: false,
            addEventListener() {},
            removeEventListener() {},
        },
        performance: { now: () => clock },
        window: {
            matchMedia: () => ({ matches: reducedMotion }),
            setInterval(callback, delay) {
                tick = callback;
                intervalDelay = delay;

                return 1;
            },
            clearInterval() {
                tick = undefined;
            },
        },
        require(name) {
            if (name.endsWith('.css')) return {};
            if (name === 'react') {
                return {
                    useState(initial) {
                        const index = cursor++;

                        if (!(index in slots)) {
                            slots[index] = initial;
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

                        if (!(index in slots)) {
                            slots[index] = { current: initial };
                        }

                        return slots[index];
                    },
                    useEffect(callback) {
                        effect = callback;
                    },
                };
            }

            if (name === '@/components/home-shorts') {
                return { compactViews: (count) => String(count) };
            }

            if (name === 'react/jsx-runtime') {
                return require(name);
            }

            return new Proxy({}, { get: (_, key) => String(key) });
        },
    };
    vm.runInNewContext(compiled, context);

    return {
        render() {
            cleanup?.();
            cursor = 0;
            const tree = context.exports.TopShortsCarousel({ shorts });
            cleanup = effect?.();

            return nodes(tree);
        },
        advance(milliseconds) {
            for (let elapsed = 0; elapsed < milliseconds; elapsed += 50) {
                clock += 50;
                tick?.();
            }
        },
        get intervalDelay() {
            return intervalDelay;
        },
        get hasTimer() {
            return Boolean(tick);
        },
        get timeStamp() {
            return clock;
        },
    };
}

const shorts = [
    {
        id: 1,
        title: 'Satu',
        description: 'Deskripsi satu',
        thumbnail_url: '/1.jpg',
        view_count: 30,
    },
    {
        id: 2,
        title: 'Dua',
        description: 'Deskripsi dua',
        thumbnail_url: '/2.jpg',
        view_count: 20,
    },
    {
        id: 3,
        title: 'Tiga',
        description: 'Deskripsi tiga',
        thumbnail_url: '/3.jpg',
        view_count: 10,
    },
];

test('top Shorts carousel fills the progress pill over five seconds and loops', () => {
    const view = mount(shorts);
    let tree = view.render();
    assert.equal(view.intervalDelay, 50);
    assert.equal(tree.filter((node) => node.type === 'Link').length, 3);
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/1',
    );
    assert.equal(
        tree.filter((node) =>
            node.props?.['aria-label']?.startsWith('Tampilkan '),
        ).length,
        3,
    );

    view.advance(2500);
    tree = view.render();
    const progress = tree.find((node) =>
        node.props?.className?.includes('bg-green-500'),
    );
    assert.equal(progress.props.style.transform, 'scaleX(0.5)');
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/1',
    );

    view.advance(2500);
    tree = view.render();
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/2',
    );
    assert.ok(
        tree.some(
            (node) => node.type === 'h3' && node.props.children === 'Dua',
        ),
    );

    tree.find(
        (node) => node.props?.['aria-label'] === 'Tampilkan Tiga',
    ).props.onClick({ timeStamp: view.timeStamp });
    tree = view.render();
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/3',
    );

    assert.equal(
        tree.find((node) => node.props?.className?.includes('bg-green-500'))
            .props.style.transform,
        'scaleX(0)',
    );
    view.advance(5000);
    tree = view.render();
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/1',
    );
});

test('one or two Shorts render without duplicated cards or unnecessary dots', () => {
    const single = mount(shorts.slice(0, 1)).render();
    assert.equal(single.filter((node) => node.type === 'Link').length, 1);
    assert.equal(
        single.filter((node) =>
            node.props?.['aria-label']?.startsWith('Tampilkan '),
        ).length,
        0,
    );

    const pair = mount(shorts.slice(0, 2)).render();
    assert.equal(pair.filter((node) => node.type === 'Link').length, 2);
    assert.equal(
        pair.filter(
            (node) =>
                node.type === 'button' &&
                node.props?.['aria-label']?.startsWith('Tampilkan '),
        ).length,
        2,
    );
});

test('clicking a progress dot restarts the full five-second interval', () => {
    const view = mount(shorts);
    let tree = view.render();
    view.advance(2500);
    tree = view.render();
    tree.find(
        (node) => node.props?.['aria-label'] === 'Tampilkan Dua',
    ).props.onClick({ timeStamp: view.timeStamp });
    tree = view.render();
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/2',
    );
    assert.equal(
        tree.find((node) => node.props?.className?.includes('bg-green-500'))
            .props.style.transform,
        'scaleX(0)',
    );

    view.advance(2500);
    tree = view.render();
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/2',
    );
    view.advance(2500);
    tree = view.render();
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/3',
    );
});

test('hover pauses automatic sliding until the pointer leaves', () => {
    const view = mount(shorts);
    let tree = view.render();
    view.advance(2500);
    tree = view.render();
    const section = tree.find((node) => node.type === 'section');
    section.props.onMouseEnter();
    tree = view.render();
    assert.equal(view.hasTimer, false);
    view.advance(5000);
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/1',
    );

    section.props.onMouseLeave();
    view.render();
    assert.equal(view.hasTimer, true);
    view.advance(2500);
    tree = view.render();
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/2',
    );
});

test('reduced motion keeps the active pill static and disables autoplay', () => {
    const view = mount(shorts, true);
    const tree = view.render();
    assert.equal(view.hasTimer, false);
    assert.equal(
        tree.find((node) => node.props?.className?.includes('bg-green-500'))
            .props.style.transform,
        'scaleX(1)',
    );
});

test('each visible card opens its own Short and contains its title, content and one view count', () => {
    const tree = mount(shorts).render();
    const links = tree.filter((node) => node.type === 'Link');
    assert.deepEqual(
        links.map((node) => node.props.href),
        ['/shorts/1', '/shorts/2', '/shorts/3'],
    );
    links.forEach((link, index) => {
        const card = nodes(link);
        assert.ok(
            card.some(
                (node) =>
                    node.type === 'h3' &&
                    node.props.children === shorts[index].title,
            ),
        );
        assert.ok(
            card.some(
                (node) =>
                    node.type === 'p' &&
                    node.props.children === shorts[index].description,
            ),
        );
        assert.equal(
            card.filter((node) =>
                node.props?.['aria-label']?.endsWith(' tayangan'),
            ).length,
            1,
        );
    });
    assert.equal(
        tree.filter((node) => node.props?.['aria-label']?.endsWith(' tayangan'))
            .length,
        3,
    );
});

test('keyboard focus pauses and resumes the remaining interval', () => {
    const view = mount(shorts);
    let tree = view.render();
    view.advance(2000);
    const section = tree.find((node) => node.type === 'section');
    section.props.onFocusCapture();
    view.render();
    assert.equal(view.hasTimer, false);
    view.advance(5000);
    section.props.onBlurCapture({
        currentTarget: { contains: () => true },
        relatedTarget: {},
    });
    view.render();
    assert.equal(view.hasTimer, false);
    section.props.onBlurCapture({
        currentTarget: { contains: () => false },
        relatedTarget: null,
    });
    view.render();
    view.advance(3000);
    tree = view.render();
    assert.equal(
        tree.find((node) => node.type === 'Link').props.href,
        '/shorts/2',
    );
});

test('empty collection has no links or timer', () => {
    const view = mount([]);
    assert.equal(
        view.render().filter((node) => node.type === 'Link').length,
        0,
    );
    assert.equal(view.hasTimer, false);
});
