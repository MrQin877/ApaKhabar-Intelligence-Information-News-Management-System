import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(
    new URL(
        '../../resources/js/components/guest-comment-limit-dialog.tsx',
        import.meta.url,
    ),
    'utf8',
);
const code = ts.transpileModule(source, {
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

test('guest limit dialog closes without posting and offers existing registration and login', () => {
    const context = {
        exports: {},
        require(name) {
            if (name === 'react/jsx-runtime') return require(name);
            return new Proxy({}, { get: (_, key) => String(key) });
        },
    };
    vm.runInNewContext(code, context);
    let open = true;
    const tree = context.exports.GuestCommentLimitDialog({
        open,
        onOpenChange: (value) => {
            open = value;
        },
    });
    const all = nodes(tree);
    assert.ok(
        all.some(
            (node) =>
                node.type === 'DialogTitle' &&
                node.props.children === 'Batas Komentar Harian Tercapai',
        ),
    );
    assert.deepEqual(
        all
            .filter((node) => node.type === 'Link')
            .map((node) => [node.props.href, node.props.children]),
        [
            ['/register', 'Daftar'],
            ['/login', 'Masuk'],
        ],
    );
    assert.equal(all.filter((node) => node.type === 'form').length, 0);
    tree.props.onOpenChange(false);
    assert.equal(open, false);
});
