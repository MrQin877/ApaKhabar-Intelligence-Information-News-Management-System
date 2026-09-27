const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync(path.resolve('resources/js/lib/phone-password-reset.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function client(cookie, replies) {
    const calls = [];
    const document = { cookie };
    const context = { exports: {}, document, AbortController, URLSearchParams,
        window: { setTimeout, clearTimeout },
        fetch: async (url, options) => {
            calls.push({ url, ...options });
            const reply = replies.shift();
            assert.ok(reply, 'Unexpected extra request');

            if (reply.cookie) {
document.cookie = reply.cookie;
}

            return { status: reply.status, ok: reply.status < 400, json: async () => reply.data ?? {} };
        },
    };
    vm.runInNewContext(source, context);

    return { request: context.exports.phoneResetRequest, calls };
}

for (const action of ['send', 'verify', 'reset']) {
    test(`${action} sends decoded XSRF token and session cookies`, async () => {
        const api = client('other=1; XSRF-TOKEN=encrypted%2Btoken%3D', [{ status: 200 }]);
        await api.request(action, { challenge: 'test' });
        assert.equal(api.calls.length, 1);
        assert.equal(api.calls[0].headers['X-XSRF-TOKEN'], 'encrypted+token=');
        assert.equal(api.calls[0].credentials, 'same-origin');
    });
}

test('initializes missing CSRF cookie before sending OTP', async () => {
    const api = client('', [{ status: 204, cookie: 'XSRF-TOKEN=fresh' }, { status: 200 }]);
    await api.request('send', { phone: '+60123456789' });
    assert.equal(api.calls[0].url, '/sanctum/csrf-cookie');
    assert.equal(api.calls[1].headers['X-XSRF-TOKEN'], 'fresh');
});

test('419 refreshes token and retries the same request exactly once', async () => {
    const api = client('XSRF-TOKEN=old', [{ status: 419 }, { status: 204, cookie: 'XSRF-TOKEN=new' }, { status: 200 }]);
    await api.request('verify', { challenge: 'test', otp: '123456' });
    assert.equal(api.calls.length, 3);
    assert.equal(api.calls[1].url, '/sanctum/csrf-cookie');
    assert.equal(api.calls[2].headers['X-XSRF-TOKEN'], 'new');
    assert.equal(api.calls[0].body, api.calls[2].body);
});

test('persistent 419 stops after one retry', async () => {
    const api = client('XSRF-TOKEN=old', [{ status: 419 }, { status: 204 }, { status: 419, data: { message: 'CSRF token mismatch.' } }]);
    await assert.rejects(api.request('send', { phone: '+60123456789' }), /CSRF token mismatch/);
    assert.equal(api.calls.length, 3);
});

for (const status of [422, 429, 503]) {
    test(`${status} is not retried and cannot trigger duplicate OTP delivery`, async () => {
        const api = client('XSRF-TOKEN=valid', [{ status, data: { message: 'Request failed' } }]);
        await assert.rejects(api.request('send', { phone: '+60123456789' }), /Request failed/);
        assert.equal(api.calls.length, 1);
    });
}

test('status reads do not require CSRF initialization', async () => {
    const api = client('', [{ status: 200 }]);
    await api.request('status', { challenge: 'test' });
    assert.equal(api.calls.length, 1);
    assert.equal(api.calls[0].method, 'GET');
});
