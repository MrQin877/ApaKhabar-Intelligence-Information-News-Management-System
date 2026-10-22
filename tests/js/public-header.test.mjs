import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../../resources/js/components/header-bar.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
let url = '/';
const context = {
    exports: {},
    require(name) {
        if (name === 'react/jsx-runtime') {
            return require(name);
        }

        if (name === '@inertiajs/react') {
            return {
                Link: 'Link',
                usePage: () => ({
                    url,
                    props: {
                        auth: { user: null },
                        categories: ['Pendidikan', 'Lingkungan'],
                        unreadNotifications: 0,
                    },
                }),
            };
        }

        if (name === '@/hooks/use-initials') {
            return { useInitials: () => () => 'A' };
        }

        if (name === '@/routes') {
            return { login: () => '/login', register: () => '/register' };
        }

        return new Proxy({}, { get: (_, key) => String(key) });
    },
};
vm.runInNewContext(code, context);

const nodes = (node) =>
    !node || typeof node !== 'object'
        ? []
        : Array.isArray(node)
          ? node.flatMap(nodes)
          : [node, ...nodes(node.props?.children)];

for (const [route, active] of [
    ['/', '/'],
    ['/news', '/news'],
    ['/news?category=Pendidikan', '/news'],
    ['/news/17', '/news'],
    ['/videos', '/videos'],
    ['/shorts/8', '/videos'],
]) {
    test(`public header keeps the same centered navigation at ${route}`, () => {
        url = route;
        const tree = nodes(context.exports.HeaderBar());
        const nav = tree.find((node) => node.props?.className?.includes('left-1/2') && node.props?.className?.includes('gap-6'));
        const links = nodes(nav).filter((node) => node.type === 'Link');

        assert.deepEqual(links.map((node) => node.props.href), ['/', '/news', '/videos']);
        assert.deepEqual(links.map((node) => node.props.children), ['Beranda', 'Berita Terbaru', 'Video']);
        assert.equal(links.find((node) => node.props.href === active).props['aria-current'], 'page');
        assert.ok(links.every((node) => !node.props.href.includes('category=')));

        const sharedLinks = tree.filter((node) => node.type === 'Link' && ['/', '/news', '/videos'].includes(node.props.href));
        assert.equal(sharedLinks.length, 7);
        assert.ok(tree.some((node) => node.type === 'img' && node.props.alt === 'ApaKhabar'));
    });
}
