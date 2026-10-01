import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../../resources/js/lib/csrf-request.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022}}).outputText;
const {csrfPost} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('uses current cookie instead of stale page token', async () => {
    global.document = {cookie: 'XSRF-TOKEN=current%3D', querySelector: () => ({content: 'stale'})};
    global.fetch = async (url, options) => {
        assert.equal(options.headers['X-XSRF-TOKEN'], 'current=');
        assert.equal(options.headers['X-CSRF-TOKEN'], undefined);
        assert.equal(options.credentials, 'same-origin');

        return new Response('{}', {status: 200});
    };
    await csrfPost('/test', {request_id: 'same'});
});

test('419 refreshes and retries once with unchanged payload', async () => {
    global.document = {cookie: 'XSRF-TOKEN=old'};
    const calls = [];
    global.fetch = async (url, options) => {
        calls.push([url, options]);

        if (url === '/sanctum/csrf-cookie') {
            document.cookie = 'XSRF-TOKEN=new';

            return new Response(null, {status: 204});
        }

        return new Response('{}', {status: calls.length === 1 ? 419 : 200});
    };
    await csrfPost('/test', {request_id: 'same'});
    assert.equal(calls.length, 3);
    assert.equal(calls[0][1].body, calls[2][1].body);
    assert.equal(calls[2][1].headers['X-XSRF-TOKEN'], 'new');
});

test('does not retry server errors or retry 419 indefinitely', async () => {
    global.document = {cookie: 'XSRF-TOKEN=old'};
    let calls = 0;
    global.fetch = async () => {
calls++;

 return new Response('{}', {status: 500});
};
    assert.equal((await csrfPost('/test', {})).status, 500);
    assert.equal(calls, 1);
    calls = 0;
    global.fetch = async url => {
calls++;

 return new Response(null, {status: url === '/sanctum/csrf-cookie' ? 204 : 419});
};
    await assert.rejects(csrfPost('/test', {}), /Sesi telah berakhir/);
    assert.equal(calls, 3);
});
