const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function formHarness() {
    const source = ts.transpileModule(readFileSync('resources/js/pages/auth/reset-password.tsx', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const calls = [];
    const states = [];
    const visits = [];
    let complete;
    const response = new Promise((resolve) => { complete = resolve; });
    class ResetError extends Error {
        constructor(message, errors = {}) { super(message); this.errors = errors; }
    }
    const exports = {};
    vm.runInNewContext(source, {
        exports,
        FormData: class { get(key) { return key === 'password' || key === 'password_confirmation' ? 'NewPassword123!' : null; } },
        require(name) {
            if (name === 'react') return { useRef: (value) => ({ current: value }), useState: (value) => [value, (next) => states.push(next)] };
            if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
            if (name === '@inertiajs/react') return { Head: 'Head', router: { visit: (...args) => visits.push(args) } };
            if (name === '@/routes/password') return { update: { url: () => '/reset-password' } };
            if (name === '@/lib/csrf-request') return { csrfPost: (...args) => { calls.push(args); return response; } };
            if (name === '@/lib/password-reset-response') return { PasswordResetError: ResetError, readPasswordResetResponse: async (result) => {
                if (!result.ok) throw new ResetError('Passwords do not match.', { password: 'Passwords do not match.' });
            } };
            if (name === '@/lib/phone-password-reset') return { PhoneResetError: class extends Error {} };
            return new Proxy({ __esModule: true, default: name }, { get: (target, key) => target[key] ?? name });
        },
    });
    const tree = exports.default({ token: 'reset-token', email: 'user@example.test' });
    const form = tree.props.children.find((child) => child?.type === 'form');
    return { submit: () => form.props.onSubmit({ preventDefault() {}, currentTarget: {} }), complete, calls, states, visits };
}

test('rapid duplicate submissions send once and success stays locked during navigation', async () => {
    const form = formHarness();
    const pending = form.submit();
    await form.submit();
    assert.equal(form.calls.length, 1);
    form.complete({ ok: true });
    await pending;
    await form.submit();
    assert.equal(form.calls.length, 1);
    assert.equal(form.visits[0][0], '/login');
    assert.equal(form.visits[0][1].replace, true);
});

test('the first validation failure exposes feedback and permits a corrected submission', async () => {
    const form = formHarness();
    const pending = form.submit();
    form.complete({ ok: false });
    await pending;
    assert.ok(form.states.some((state) => state?.password === 'Passwords do not match.'));
    await form.submit();
    assert.equal(form.calls.length, 2);
    assert.equal(form.visits.length, 0);
});
