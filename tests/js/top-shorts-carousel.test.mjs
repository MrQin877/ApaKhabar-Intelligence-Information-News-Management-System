import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const richText = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../resources/js/lib/rich-text.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: richText });
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
function render(shorts) {
    const context = {
        exports: {},
        require(name) {
            if (name.endsWith('.css')) return {};
            if (name === '@/components/home-shorts')
                return { compactViews: String };
            if (name === '@/lib/rich-text') return richText;
            if (name === 'react/jsx-runtime') return require(name);
            return new Proxy({}, { get: (_, key) => String(key) });
        },
    };
    vm.runInNewContext(compiled, context);
    return nodes(context.exports.TopShortsCarousel({ shorts }));
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

test('top three stay in rank order with fixed badges and no carousel controls', () => {
    const tree = render(shorts);
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
                    node.type === 'span' &&
                    node.props.children?.join?.('') === `No. ${index + 1}`,
            ),
        );
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
    assert.equal(tree.filter((node) => node.type === 'button').length, 0);
    assert.doesNotMatch(
        source,
        /setInterval|useEffect|onMouseEnter|Pilih video populer/,
    );
});

test('empty and partial collections show only available Shorts', () => {
    assert.equal(render([]).filter((node) => node.type === 'Link').length, 0);
    assert.deepEqual(
        render(shorts.slice(0, 1))
            .filter((node) => node.type === 'Link')
            .map((node) => node.props.href),
        ['/shorts/1'],
    );
    assert.deepEqual(
        render(shorts.slice(0, 2))
            .filter((node) => node.type === 'Link')
            .map((node) => node.props.href),
        ['/shorts/1', '/shorts/2'],
    );
});

test('new server ranking appears directly without local rotation state', () => {
    const reordered = [shorts[2], shorts[0], shorts[1]];
    assert.deepEqual(
        render(reordered)
            .filter((node) => node.type === 'Link')
            .map((node) => node.props.href),
        ['/shorts/3', '/shorts/1', '/shorts/2'],
    );
});
