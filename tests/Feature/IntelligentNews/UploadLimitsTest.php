<?php

use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;

test('oversized uploads get a small response instead of rendering the request body', function () {
    config(['app.debug' => true]);
    $request = Request::create('/admin/documents', 'POST', server: ['CONTENT_LENGTH' => 33706139], content: str_repeat('x', 1024 * 1024));
    $response = app(ExceptionHandler::class)->render($request, new PostTooLargeException);
    expect($response->getStatusCode())->toBe(413);
    expect(strlen($response->getContent()))->toBeLessThan(2048);
    expect($response->getContent())->toContain('20 MB')->not->toContain(str_repeat('x', 100));
});

test('oversized JSON uploads return a readable 413 response', function () {
    $request = Request::create('/admin/documents', 'POST', server: ['HTTP_ACCEPT' => 'application/json']);
    $response = app(ExceptionHandler::class)->render($request, new PostTooLargeException);
    expect($response->getStatusCode())->toBe(413);
    expect(json_decode($response->getContent(), true)['message'])->toContain('20 MB');
});
