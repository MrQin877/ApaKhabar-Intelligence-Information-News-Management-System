<?php

use App\Services\WebsiteTranslation;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    config(['translation.url' => 'http://localhost:5005', 'translation.cache_store' => 'array']);
    Cache::store('array')->flush();
    Http::preventStrayRequests();
});

test('translates batches as plain text and caches per target', function () {
    Http::fake(['localhost:5005/translate' => Http::response(['translatedText' => ['Hello', 'News']])]);
    $translator = app(WebsiteTranslation::class);
    expect($translator->translate(['Halo', 'Berita'], 'en'))->toBe(['Hello', 'News']);
    expect($translator->translate(['Halo', 'Berita'], 'en'))->toBe(['Hello', 'News']);
    Http::assertSentCount(1);
    Http::assertSent(fn ($request) => $request['source'] === 'auto' && $request['target'] === 'en' && $request['format'] === 'text');
});

test('preserves mixed cached and uncached response order', function () {
    Http::fakeSequence()->push(['translatedText' => ['Hello']])->push(['translatedText' => ['News']]);
    $translator = app(WebsiteTranslation::class);
    $translator->translate(['Halo'], 'en');
    expect($translator->translate(['Berita', 'Halo'], 'en'))->toBe(['News', 'Hello']);
});

test('rejects malformed upstream responses without caching them', function () {
    Http::fakeSequence()->push(['translatedText' => [null]])->push(['translatedText' => ['Hello']]);
    $translator = app(WebsiteTranslation::class);
    expect(fn () => $translator->translate(['Halo'], 'en'))->toThrow(RuntimeException::class);
    expect($translator->translate(['Halo'], 'en'))->toBe(['Hello']);
    Http::assertSentCount(2);
});

test('validates language and payload limits at the website endpoint', function () {
    $this->postJson('/website/translate', ['target' => 'fr', 'texts' => ['Hello']])->assertUnprocessable();
    $this->postJson('/website/translate', ['target' => 'id', 'texts' => array_fill(0, 21, 'Hello')])->assertUnprocessable();
    $this->postJson('/website/translate', ['target' => 'id', 'texts' => array_fill(0, 5, str_repeat('a', 3000))])->assertUnprocessable();
    Http::assertNothingSent();
});

test('returns a safe failure when LibreTranslate is unavailable', function () {
    Http::fake(['*' => Http::response(['error' => 'secret upstream details'], 500)]);
    $this->postJson('/website/translate', ['target' => 'en', 'texts' => ['Halo']])
        ->assertStatus(503)->assertExactJson(['message' => 'Translation is temporarily unavailable.']);
});

test('returns valid translations when cache reads and writes fail', function () {
    $cache = Mockery::mock(Illuminate\Contracts\Cache\Repository::class);
    $cache->shouldReceive('get')->once()->andThrow(new RuntimeException('unwritable cache'));
    $cache->shouldReceive('put')->once()->andThrow(new RuntimeException('unwritable cache'));
    Cache::shouldReceive('store')->andReturn($cache);
    Http::fake(['localhost:5005/translate' => Http::response(['translatedText' => ['Hello']])]);
    $this->postJson('/website/translate', ['target' => 'en', 'texts' => ['Halo']])
        ->assertOk()->assertExactJson(['translations' => ['Hello']]);
});
