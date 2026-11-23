import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPasswordResetResponse, PasswordResetError } from '../../resources/js/lib/password-reset-response.ts';

test('recognizes the first successful reset response', async () => {
    await readPasswordResetResponse(Response.json({ message: 'Your password has been reset.' }));
});

test('shows password validation errors from the first failed response', async () => {
    await assert.rejects(
        readPasswordResetResponse(Response.json({ message: 'Passwords do not match.', errors: { password: ['Passwords do not match.'] } }, { status: 422 })),
        (error) => error instanceof PasswordResetError && error.errors.password === 'Passwords do not match.',
    );
});

test('exposes expired token errors even when attached to the readonly email field', async () => {
    await assert.rejects(
        readPasswordResetResponse(Response.json({ message: 'This password reset token is invalid.', errors: { email: ['This password reset token is invalid.'] } }, { status: 422 })),
        (error) => error.message.includes('token is invalid') && Boolean(error.errors.email),
    );
});

test('does not mistake an HTML response or malformed success for a successful reset', async () => {
    for (const response of [new Response('<html>Sign in</html>'), Response.json({})]) {
        await assert.rejects(readPasswordResetResponse(response), /belum dapat dipastikan/);
    }
});

test('reports rate limiting and server failures instead of remaining silent', async () => {
    await assert.rejects(readPasswordResetResponse(Response.json({}, { status: 429 })), /Terlalu banyak/);
    await assert.rejects(readPasswordResetResponse(new Response('Gateway error', { status: 502 })), /belum berhasil/);
});
