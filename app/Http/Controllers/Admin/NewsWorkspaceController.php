<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsSession;
use App\Models\News;
use App\Models\NewsCategory;
use App\Services\FacebookPublishingService;
use App\Services\InstagramService;
use App\Services\News\ArticleHtml;
use App\Services\News\MetaConnections;
use App\Services\NewsImageCropService;
use App\Support\ArticleText;
use App\Support\NewsImageUrl;
use App\Support\PublishLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class NewsWorkspaceController extends Controller
{
    public function index(Request $request): Response
    {
        $userId = $request->user()->getKey();

        $drafts = IntelligentNewsDraft::query()
            ->with(['category:categoryID,name', 'session:id,draft_id', 'qualityEvaluations'])
            ->where('created_by', $userId)
            ->whereIn('status', ['draft', 'archived', 'published'])
            ->whereNull('published_news_id')
            ->latest('updated_at')
            ->get()
            ->map(function (IntelligentNewsDraft $draft) {
                $quality = $draft->qualityEvaluations->first();

                return [
                    'key' => "draft-{$draft->id}",
                    'id' => $draft->id,
                    'record_type' => 'draft',
                    'title' => $draft->title,
                    'preview' => ArticleText::preview($this->publicationContent($draft)),
                    'status' => $draft->status === 'archived' ? 'archived' : ($draft->publicationResults() ? 'active' : 'draft'),
                    ...$this->publicationCard($draft),
                    'creation_method' => $draft->creation_method,
                    'category' => $draft->category?->name,
                    'updated_at' => $draft->updated_at?->toISOString(),
                    'resume_url' => $draft->creation_method === 'ai'
                        ? route('admin.assistant.index', array_filter([
                            'session' => $draft->session?->id,
                            'draft' => $draft->id,
                        ]))
                        : route('admin.news-workspace.manual.edit', $draft),
                    'can_publish' => $draft->status === 'draft' && ! $draft->publicationResults() && ! $quality?->publish_blocked,
                    'quality_score' => $quality?->overall_score,
                    'quality_label' => $quality?->quality_label,
                    'publish_blocked' => $quality?->publish_blocked ?? false,
                ];
            });

        $sessions = IntelligentNewsSession::query()
            ->where('created_by', $userId)
            ->whereNull('draft_id')
            ->where(function ($query) {
                $query->where('current_intent', 'generate_news')
                    ->orWhere(function ($legacy) {
                        $legacy->whereNull('current_intent')
                            ->whereHas('messages', fn ($messages) => $messages
                                ->where('role', 'user')
                                ->whereIn('intent', ['generate_news', 'revise_news']));
                    });
            })
            ->latest('updated_at')
            ->get()
            ->map(fn (IntelligentNewsSession $session) => [
                'key' => "session-{$session->id}",
                'id' => $session->id,
                'record_type' => 'session',
                'title' => $session->prompt ?: 'Percakapan AI tanpa judul',
                'preview' => count($session->pending_questions ?? []).' informasi masih diperlukan',
                'status' => $session->archived_at ? 'archived' : 'draft',
                'creation_method' => 'ai',
                'category' => null,
                'updated_at' => $session->updated_at?->toISOString(),
                'resume_url' => route('admin.assistant.index', ['session' => $session->id]),
                'can_publish' => false,
                'quality_score' => null,
                'quality_label' => null,
                'publish_blocked' => false,
            ]);

        $publicationDrafts = IntelligentNewsDraft::whereNotNull('published_news_id')->get()->keyBy('published_news_id');
        $published = News::query()
            ->with('categoryRecord:categoryID,name')
            ->latest('updated_at')
            ->get()
            ->map(fn (News $news) => [
                'key' => "news-{$news->getKey()}",
                'id' => $news->getKey(),
                'record_type' => 'news',
                ...$this->publicationCard($publicationDrafts->get($news->getKey()), $news),
                'title' => $news->title,
                'preview' => ArticleText::preview($news->content),
                'status' => $news->status,
                'creation_method' => $news->creation_method,
                'category' => $news->category,
                'updated_at' => $news->updated_at?->toISOString(),
                'resume_url' => route('news.show', $news->getKey()),
                'can_publish' => false,
                'quality_score' => null,
                'quality_label' => null,
                'publish_blocked' => false,
            ]);

        return Inertia::render('admin/intelligentnewscreator/index', [
            'publishPlatforms' => $this->publishPlatforms(),
            'items' => $drafts->concat($sessions)->concat($published)
                ->sortByDesc('updated_at')->values(),
            'counts' => [
                'draft' => $drafts->where('status', 'draft')->count() + $sessions->where('status', 'draft')->count(),
                'active' => $drafts->where('status', 'active')->count() + $published->where('status', 'active')->count(),
                'archived' => $drafts->where('status', 'archived')->count() + $sessions->where('status', 'archived')->count() + $published->where('status', 'archived')->count(),
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/intelligentnewscreator/editor', [
            'draft' => null,
            'categories' => $this->categories(),
            'publishPlatforms' => $this->publishPlatforms(),
            'metaAuth' => app(MetaConnections::class)->publicConfig(),
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        try {
            return $this->preparePreview($request);
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json(['message' => 'Pratinjau belum dapat disiapkan. Silakan coba lagi.'], 500);
        }
    }

    private function preparePreview(Request $request): JsonResponse
    {
        // Prepare through the same sanitizer, upload and crop pipeline as saving.
        $request->merge(['intent' => 'draft']);
        $directory = 'news-images/previews/'.Str::uuid();
        $disk = Storage::disk(config('filesystems.news_media_disk', 'public'));
        if (! $disk->put($directory.'/created-at', (string) now()->timestamp)) {
            throw new \RuntimeException('Unable to initialize publication preview storage.');
        }
        $data = $this->validateDraftData($request, $directory);
        $attributes = $this->draftAttributes($data, $request->user()->getKey());
        $content = $attributes['content'];
        $caption = ArticleText::post($attributes['title'], $content);
        $images = collect(['website', 'facebook', 'instagram'])->mapWithKeys(
            fn ($platform) => [$platform => NewsImageUrl::resolve($data['image_variants'][$platform] ?? $data['image'] ?? null)]
        )->all();
        $issues = [];
        if (! $images['instagram']) {
            $issues['instagram'][] = 'Gambar Instagram belum siap. Kembali dan tambahkan foto sampul.';
        } elseif (! isset($data['image_variants']['instagram'])) {
            $issues['instagram'][] = 'Gambar Instagram belum siap. Kembali dan gunakan Pratinjau & Sesuaikan untuk menyiapkan gambar.';
        }
        if (mb_strlen($caption) > 2200) {
            $issues['instagram'][] = 'Teks Instagram terlalu panjang. Pendekkan judul dan isi berita hingga maksimal 2.200 karakter.';
        }
        $token = (string) Str::uuid();
        Cache::put('publication-preview:'.$token, [
            'user_id' => $request->user()->getKey(), 'data' => $data, 'issues' => $issues,
        ], now()->addHour());

        return response()->json([
            'token' => $token, 'title' => $attributes['title'], 'content' => $content,
            'category' => NewsCategory::find($data['category_id'] ?? null)?->name,
            'caption' => $caption, 'images' => $images, 'issues' => $issues,
        ]);
    }

    public function previewAi(Request $request, IntelligentNewsDraft $draft): JsonResponse
    {
        $this->authorizeDraft($request, $draft);
        abort_unless($draft->creation_method === 'ai' && $draft->status === 'draft', 422);
        $request->validate(['version' => ['required', 'integer', Rule::in([$draft->version])]]);
        $content = $this->publicationContent($draft);
        $caption = ArticleText::post($draft->title, $content);
        $images = collect(['website', 'facebook', 'instagram'])->mapWithKeys(
            fn ($platform) => [$platform => NewsImageUrl::resolve($draft->image_variants[$platform] ?? $draft->image)]
        )->all();
        $issues = [];
        if (! isset($draft->image_variants['instagram'])) {
            $issues['instagram'][] = 'Tambahkan foto dan sesuaikan potongan gambar sebelum menerbitkan ke Instagram.';
        }
        if (mb_strlen($caption) > 2200) {
            $issues['instagram'][] = 'Teks Instagram maksimal 2.200 karakter. Pendekkan berita sebelum menerbitkan.';
        }
        $token = (string) Str::uuid();
        Cache::put('ai-publication-preview:'.$token, [
            'user_id' => $request->user()->getKey(),
            'draft_id' => $draft->id,
            'fingerprint' => hash('sha256', json_encode($draft->getAttributes())),
            'issues' => $issues,
        ], now()->addHour());

        return response()->json([
            'token' => $token, 'title' => $draft->title, 'content' => $content,
            'category' => $draft->category?->name, 'caption' => $caption,
            'images' => $images, 'issues' => $issues,
        ]);
    }

    public function cropAi(Request $request, IntelligentNewsDraft $draft): RedirectResponse
    {
        $this->authorizeDraft($request, $draft);
        abort_unless($draft->creation_method === 'ai' && $draft->status === 'draft', 422);
        $request->validate([
            'version' => ['required', 'integer', Rule::in([$draft->version])],
            'image_crops' => ['required', 'array'],
            'image_crops.sync' => ['required', 'boolean'],
            'image_crops.instagram.type' => ['sometimes', Rule::in(['portrait', 'square', 'landscape'])],
            'image_crops.facebook.type' => ['sometimes', Rule::in(['portrait', 'square', 'landscape'])],
            ...collect(['website', 'instagram', 'facebook'])->flatMap(fn ($platform) => [
                "image_crops.$platform.x" => ['required', 'numeric', 'between:0,1'],
                "image_crops.$platform.y" => ['required', 'numeric', 'between:0,1'],
                "image_crops.$platform.zoom" => ['required', 'numeric', 'between:1,4'],
            ])->all(),
        ]);
        $crops = $request->input('image_crops');
        $variants = app(NewsImageCropService::class)->generate($draft->image ?? '', $crops);
        $draft->update([
            'image_crops' => $crops, 'image_variants' => $variants,
            'version' => $draft->version + 1, 'reviewed_at' => null,
        ]);

        $draft->versions()->create([
            'version' => $draft->version, 'change_type' => 'image_changed',
            'revision_source' => 'manual', 'created_by' => $request->user()->getKey(),
            'snapshot' => $draft->only([
                'title', 'content', 'excerpt', 'labels', 'sources_used', 'warnings',
                'category_id', 'image', 'image_crops', 'image_variants', 'user_prompt',
            ]),
        ]);

        return back()->with('success', 'Potongan gambar berhasil disimpan.');
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $data = $this->validateDraft($request);
        $draft = IntelligentNewsDraft::create($this->draftAttributes($data, $request->user()->getKey()));

        if (($data['intent'] ?? 'draft') === 'publish') {
            $draft->update(['reviewed_at' => now()]);

            return $this->publish($request, $draft);
        }

        return redirect()->route('admin.news-workspace.manual.edit', $draft)
            ->with('success', 'Draf manual berhasil disimpan.');
    }

    public function edit(Request $request, IntelligentNewsDraft $draft): Response
    {
        $this->authorizeDraft($request, $draft);

        return Inertia::render('admin/intelligentnewscreator/editor', [
            'draft' => [
                'id' => $draft->id,
                'headline' => $draft->title,
                'content' => $this->publicationContent($draft),
                'content_html' => app(ArticleHtml::class)->sanitize(
                    preg_match('/<(p|div|br|strong|b|em|i|u|ul|ol|li|blockquote)\b/i', $this->publicationContent($draft))
                        ? $this->publicationContent($draft)
                        : nl2br(e($this->publicationContent($draft)))
                ),
                'category_id' => $draft->category_id,
                'image' => $draft->image,
                'image_crops' => $draft->image_crops,
                'status' => $draft->status,
                'show_on_homepage' => $draft->show_on_homepage,
            ],
            'categories' => $this->categories(),
            'publishPlatforms' => $this->publishPlatforms(),
            'metaAuth' => app(MetaConnections::class)->publicConfig(),
        ]);
    }

    public function update(Request $request, IntelligentNewsDraft $draft): RedirectResponse|JsonResponse
    {
        $this->authorizeDraft($request, $draft);
        abort_unless($draft->creation_method === 'manual', 422, 'Only manual drafts can use the manual editor.');
        abort_unless($draft->status === 'draft', 422, 'Only active drafts can be edited.');
        $data = $this->validateDraft($request);
        $draft->update($this->draftAttributes($data, $request->user()->getKey()));

        if (($data['intent'] ?? 'draft') === 'publish') {
            $draft->update(['reviewed_at' => now()]);

            return $this->publish($request, $draft);
        }

        return back()->with('success', 'Draf berhasil diperbarui.');
    }

    public function publish(Request $request, IntelligentNewsDraft $draft): RedirectResponse|JsonResponse
    {
        $this->authorizeDraft($request, $draft);
        abort_unless($draft->status === 'draft', 422, 'Only draft content can be published.');
        if ($draft->creation_method === 'ai' && $request->filled('preview_token')) {
            $preview = Cache::get('ai-publication-preview:'.$request->string('preview_token'));
            if (! $preview || $preview['user_id'] !== $request->user()->getKey()
                || $preview['draft_id'] !== $draft->id
                || $preview['fingerprint'] !== hash('sha256', json_encode($draft->getAttributes()))) {
                throw ValidationException::withMessages(['preview_token' => 'Draf berubah atau pratinjau kedaluwarsa. Buka pratinjau kembali.']);
            }
            foreach ($request->input('platforms', ['website']) as $platform) {
                if (! empty($preview['issues'][$platform])) {
                    throw ValidationException::withMessages(['platforms' => $preview['issues'][$platform]]);
                }
            }
        }
        $confirmReview = $draft->creation_method === 'ai' && $request->boolean('confirm_review');
        if ($confirmReview) {
            $request->validate(['confirm_review' => ['accepted'], 'version' => ['required', 'integer', Rule::in([$draft->version])]]);
        }
        abort_unless($draft->reviewed_at !== null || $confirmReview, 422, 'Review the current draft version before publishing.');
        $latestQuality = $draft->qualityEvaluations()->first();
        abort_if(
            $draft->creation_method === 'ai' && $latestQuality?->publish_blocked,
            422,
            'Resolve unsupported, contradicted, or unsafe content before publishing.',
        );

        $platforms = $request->input('platforms', ['website']);
        $request->merge(['platforms' => $platforms]);
        $this->validatePlatforms($request);
        if ($draft->creation_method === 'ai') {
            $request->validate(['version' => ['sometimes', 'required', 'integer', Rule::in([$draft->version])]]);
        }

        if ($confirmReview) {
            $draft->update(['reviewed_at' => now()]);
        }

        $context = $this->publishContext($request, $draft->id);
        PublishLog::write('request_received', $context);
        PublishLog::write('selected_platforms', $context);
        PublishLog::write('validation_passed', $context);
        $draft->update(['publication_started_at' => $draft->publication_started_at ?? now()]);
        $results = [];
        foreach ($platforms as $platform) {
            $key = $platform === 'website' ? 'application' : $platform;
            PublishLog::write($key.'.started', $context);
            try {
                $id = DB::transaction(function () use ($request, $draft, $platform, $context) {
                    $draft = IntelligentNewsDraft::whereKey($draft->id)->lockForUpdate()->firstOrFail();
                    if ($platform === 'website') {
                        if ($draft->published_news_id) {
                            return $draft->published_news_id;
                        }
                        $news = News::create([
                            'title' => $draft->title,
                            'content' => $this->publicationContent($draft),
                            'excerpt' => $draft->creation_method === 'ai' ? $draft->lead : $draft->excerpt,
                            'image' => $draft->image_variants['website'] ?? $draft->image,
                            'category_id' => $draft->category_id,
                            'status' => 'active',
                            'creation_method' => $draft->creation_method,
                            'created_by' => $request->user()->getKey(),
                            'show_on_homepage' => $draft->show_on_homepage,
                        ]);
                        $draft->update(['published_news_id' => $news->getKey()]);

                        return $news->getKey();
                    }
                    if ($platform === 'facebook') {
                        if ($draft->facebook_post_id) {
                            return $draft->facebook_post_id;
                        }
                        $message = ArticleText::post($draft->title, $this->publicationContent($draft));
                        $id = app(FacebookPublishingService::class)->publish(NewsImageUrl::resolve($draft->image_variants['facebook'] ?? $draft->image), $message, $context);
                        $draft->update(['facebook_post_id' => $id]);

                        return $id;
                    }
                    if ($draft->instagram_media_id) {
                        return $draft->instagram_media_id;
                    }
                    $caption = ArticleText::post($draft->title, $this->publicationContent($draft));
                    $id = app(InstagramService::class)->publish(
                        NewsImageUrl::resolve($draft->image_variants['instagram'] ?? $draft->image) ?? '', $caption, $context,
                        isset($draft->image_variants['instagram']),
                    );
                    $draft->update(['instagram_media_id' => $id]);

                    return $id;
                });
                $results[$key] = ['success' => true, 'message' => match ($platform) {
                    'website' => 'Berhasil diterbitkan ke Aplikasi',
                    'facebook' => 'Berhasil diterbitkan ke Facebook',
                    default => 'Berhasil diterbitkan ke Instagram',
                }];
                PublishLog::write($key.'.success', [...$context, 'news_id' => $platform === 'website' ? $id : null, 'media_id' => $platform === 'instagram' ? $id : null]);
            } catch (\Throwable $exception) {
                $message = $exception instanceof ValidationException
                    ? (collect($exception->errors())->flatten()->first() ?? 'Penerbitan gagal. Silakan coba lagi.')
                    : 'Penerbitan gagal. Silakan coba lagi atau hubungi administrator.';
                $results[$key] = ['success' => false, 'message' => $message];
                PublishLog::write($key.'.failure', [...$context, 'exception' => $exception::class, 'exception_message' => $exception->getMessage()], 'error');
            }
        }
        DB::transaction(function () use ($draft, $results) {
            $locked = IntelligentNewsDraft::whereKey($draft->id)->lockForUpdate()->firstOrFail();
            $merged = array_replace($locked->publication_results ?? [], $results);
            foreach (['application' => $locked->published_news_id, 'facebook' => $locked->facebook_post_id, 'instagram' => $locked->instagram_media_id] as $key => $id) {
                if ($id) {
                    $merged[$key] = ['success' => true];
                }
            }
            $locked->update(['publication_results' => $merged]);
        });
        $allSuccessful = collect($draft->fresh()->publicationResults())->every(fn ($result) => $result['success']);
        $success = $request->attributes->get('failed_platform_retry')
            ? $allSuccessful : collect($results)->every(fn ($result) => $result['success']);
        $draft->refresh();
        if ($allSuccessful) {
            $draft->update(['status' => 'published']);
        }
        $result = ['success' => $success, 'results' => $results, 'draft_id' => $draft->id,
            'attempt_id' => $context['attempt_id'], 'retry_url' => $draft->creation_method === 'ai' ? route('admin.assistant.index', ['draft' => $draft->id]) : route('admin.news-workspace.manual.edit', $draft),
            'completion_url' => route('admin.news-workspace.index')];
        PublishLog::write('final_result', [...$context, 'news_id' => $draft->published_news_id, ...$result]);
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json($result);
        }

        return redirect($result['retry_url'])->with('publishResult', $result);
    }

    private function publicationContent(IntelligentNewsDraft $draft): string
    {
        return $draft->content;
    }

    private function publicationCard(?IntelligentNewsDraft $draft, ?News $news = null): array
    {
        $results = $draft?->publicationResults() ?? ['application' => ['success' => true]];
        $failed = collect($results)->filter(fn ($result) => ($result['success'] ?? null) === false)->keys();
        $canRetry = $draft && (int) $draft->created_by === (int) auth()->id()
            && $draft->status === 'draft' && $news?->status !== 'archived' && $failed->isNotEmpty();

        return [
            'publication_results' => $results,
            'published_at' => ($news?->created_at ?? $draft?->publication_started_at)?->toISOString(),
            'view_url' => $news ? route('news.show', $news->getKey()) : null,
            'retry_url' => $canRetry ? route('admin.news-workspace.drafts.retry', $draft) : null,
        ];
    }

    public function retry(Request $request, IntelligentNewsDraft $draft): JsonResponse
    {
        $this->authorizeDraft($request, $draft);
        $this->validatePlatforms($request);

        return DB::transaction(function () use ($request, $draft) {
            $draft = IntelligentNewsDraft::whereKey($draft->id)->lockForUpdate()->firstOrFail();
            abort_unless($draft->status === 'draft', 422, 'Berita ini tidak tersedia untuk penerbitan ulang.');
            abort_if($draft->published_news_id && News::whereKey($draft->published_news_id)->where('status', 'archived')->exists(), 422);
            $results = $draft->publicationResults();
            foreach ($request->input('platforms') as $platform) {
                $key = $platform === 'website' ? 'application' : $platform;
                if (($results[$key]['success'] ?? null) !== false) {
                    throw ValidationException::withMessages(['platforms' => 'Hanya platform yang gagal dapat diulangi.']);
                }
            }
            // Reuse publishing and its saved-ID deduplication without editing or cloning content.
            $request->headers->set('Accept', 'application/json');
            $request->headers->remove('X-Inertia');
            $request->attributes->set('failed_platform_retry', true);

            return $this->publish($request, $draft);
        });
    }

    private function publishContext(Request $request, ?int $draftId = null): array
    {
        if (! $request->attributes->has('publish_attempt')) {
            $request->attributes->set('publish_attempt', (string) Str::uuid());
        }

        return ['attempt_id' => $request->attributes->get('publish_attempt'), 'draft_id' => $draftId,
            'selected_platforms' => $request->input('platforms', ['website'])];
    }

    public function archive(Request $request, string $type, int $id): RedirectResponse
    {
        $this->changeArchiveState($request, $type, $id, true);

        return back()->with('success', 'Item dipindahkan ke arsip.');
    }

    public function restore(Request $request, string $type, int $id): RedirectResponse
    {
        $this->changeArchiveState($request, $type, $id, false);

        return back()->with('success', 'Item berhasil dipulihkan.');
    }

    private function changeArchiveState(Request $request, string $type, int $id, bool $archive): void
    {
        abort_unless(in_array($type, ['draft', 'session', 'news'], true), 404);

        if ($type === 'draft') {
            $draft = IntelligentNewsDraft::findOrFail($id);
            $this->authorizeDraft($request, $draft);
            $draft->update(['status' => $archive ? 'archived' : 'draft']);
        } elseif ($type === 'session') {
            $session = IntelligentNewsSession::where('created_by', $request->user()->getKey())->findOrFail($id);
            $session->update(['archived_at' => $archive ? now() : null]);
        } else {
            News::findOrFail($id)->update(['status' => $archive ? 'archived' : 'active']);
        }
    }

    private function validateDraft(Request $request): array
    {
        if ($request->input('intent') !== 'publish') {
            return $this->validateDraftData($request);
        }
        $context = $this->publishContext($request, $request->route('draft')?->id);
        PublishLog::write('request_received', $context);
        PublishLog::write('selected_platforms', $context);
        try {
            $data = $this->validateDraftData($request);
            PublishLog::write('validation_passed', $context);

            return $data;
        } catch (ValidationException $exception) {
            PublishLog::write('validation_failed', [...$context, 'fields' => array_keys($exception->errors()), 'exception_message' => $exception->getMessage()], 'warning');
            $results = [];
            foreach ((array) $request->input('platforms', []) as $platform) {
                if (in_array($platform, ['website', 'instagram', 'facebook'], true)) {
                    $results[$platform === 'website' ? 'application' : $platform] = ['success' => false, 'message' => 'Konten atau pilihan platform belum valid. Periksa isian berita.'];
                }
            }
            $result = ['success' => false, 'results' => $results, 'attempt_id' => $context['attempt_id']];
            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                $exception->response = response()->json([
                    ...$result,
                    'message' => $exception->getMessage(),
                    'errors' => $exception->errors(),
                ], 422);
            } else {
                $request->session()->flash('publishResult', $result);
            }
            PublishLog::write('final_result', [...$context, ...$result]);
            throw $exception;
        }
    }

    private function validateDraftData(Request $request, ?string $previewDirectory = null): array
    {
        if ($request->filled('preview_token')) {
            $prepared = Cache::get('publication-preview:'.$request->input('preview_token'));
            if (! $prepared || $prepared['user_id'] !== $request->user()->getKey()) {
                throw ValidationException::withMessages(['platforms' => 'Pratinjau sudah berakhir. Buka kembali pratinjau sebelum menerbitkan.']);
            }
            $this->validatePlatforms($request);
            foreach ($request->input('platforms') as $platform) {
                if (! empty($prepared['issues'][$platform])) {
                    throw ValidationException::withMessages(['platforms' => $prepared['issues'][$platform]]);
                }
            }

            return [...$prepared['data'], 'intent' => 'publish', 'platforms' => $request->input('platforms')];
        }

        if (is_string($request->input('image_crops'))) {
            $request->merge(['image_crops' => json_decode($request->input('image_crops'), true) ?? 'invalid']);
        }
        $data = $request->validate([
            'image_crops' => ['nullable', 'array:sync,website,instagram,facebook'],
            'image_crops.sync' => ['required_with:image_crops', 'boolean'],
            'image_crops.website' => ['required_with:image_crops', 'array:x,y,zoom'],
            'image_crops.instagram' => ['required_with:image_crops', 'array:x,y,zoom,type'],
            'image_crops.facebook' => ['required_with:image_crops', 'array:x,y,zoom,type'],
            'image_crops.instagram.type' => ['sometimes', Rule::in(['portrait', 'square', 'landscape'])],
            'image_crops.facebook.type' => ['sometimes', Rule::in(['portrait', 'square', 'landscape'])],
            ...collect(['website', 'instagram', 'facebook'])->flatMap(fn ($platform) => [
                "image_crops.$platform.x" => ['required_with:image_crops', 'numeric', 'between:0,1'],
                "image_crops.$platform.y" => ['required_with:image_crops', 'numeric', 'between:0,1'],
                "image_crops.$platform.zoom" => ['required_with:image_crops', 'numeric', 'between:1,4'],
            ])->all(),
            'headline' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'min:20', 'max:100000'],
            'category_id' => ['nullable', 'integer', Rule::exists('news_categories', 'categoryID')->where('is_active', true)->whereNull('deleted_at')],
            'image' => ['nullable', 'url', 'max:2048'],
            'cover_photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
            'show_on_homepage' => ['sometimes', 'boolean'],
            'content_format' => ['sometimes', Rule::in(['html', 'text'])],
            'intent' => ['sometimes', Rule::in(['draft', 'publish'])],
            'platforms' => ['exclude_unless:intent,publish', 'required', 'array', 'min:1', 'max:3'],
            'platforms.*' => ['string', 'distinct', Rule::in(['website', 'facebook', 'instagram'])],
        ]);

        if (($data['intent'] ?? 'draft') === 'publish') {
            $this->validatePlatforms($request);
        }

        if (($data['content_format'] ?? 'text') === 'html') {
            $data['content'] = app(ArticleHtml::class)->sanitize($data['content']);
            if (mb_strlen(trim(html_entity_decode(strip_tags($data['content'])))) < 20) {
                throw ValidationException::withMessages(['content' => 'Isi berita harus berisi setidaknya 20 karakter teks.']);
            }
        }

        if ($request->hasFile('cover_photo')) {
            $disk = config('filesystems.news_media_disk', 'public');
            $path = $request->file('cover_photo')->storePublicly($previewDirectory ?? 'news-images', $disk);
            if (! $path) {
                throw ValidationException::withMessages(['cover_photo' => 'Gambar gagal disimpan. Silakan coba lagi.']);
            }
            $data['image'] = $disk === 'public'
                ? rtrim(config('app.url'), '/').'/storage/'.$path
                : Storage::disk($disk)->url($path);
        }

        // The upload has been persisted; only its URL belongs in a reusable snapshot.
        unset($data['cover_photo']);

        $data['image'] = NewsImageUrl::resolve($data['image'] ?? null);
        $data['image_variants'] = ! empty($data['image_crops'])
            ? app(NewsImageCropService::class)->generate($data['image'] ?? '', $data['image_crops'], $previewDirectory ? $previewDirectory.'/crops' : 'news-images/crops') : null;

        return $data;
    }

    private function validatePlatforms(Request $request): void
    {
        $data = $request->validate([
            'platforms' => ['required', 'array', 'min:1', 'max:3'],
            'platforms.*' => ['required', 'string', 'distinct', Rule::in(['website', 'facebook', 'instagram'])],
        ]);
        foreach (app(MetaConnections::class)->platforms($request->user()->getKey()) as $platform) {
            if (in_array($platform['id'], $data['platforms'], true) && $platform['status'] !== 'connected') {
                throw ValidationException::withMessages(['platforms' => $platform['name'].' belum terhubung. Buka Settings > Integration.']);
            }
        }
        if (in_array('facebook', $data['platforms'], true) && ! app(FacebookPublishingService::class)->configured()) {
            throw ValidationException::withMessages(['platforms' => 'Halaman Facebook belum dikonfigurasi. Hubungi administrator.']);
        }

    }

    private function draftAttributes(array $data, int $userId): array
    {
        return [
            'created_by' => $userId,
            'creation_method' => 'manual',
            'category_id' => $data['category_id'] ?? null,
            'image' => $data['image'] ?? null,
            'image_crops' => $data['image_crops'] ?? null,
            'image_variants' => $data['image_variants'] ?? null,
            'title' => $data['headline'],
            'content' => $data['content'],
            'excerpt' => ArticleText::preview($data['content']),
            'labels' => [],
            'sources_used' => [],
            'warnings' => [],
            'status' => 'draft',
            'show_on_homepage' => $data['show_on_homepage'] ?? true,
            'reviewed_at' => null,
        ];
    }

    private function authorizeDraft(Request $request, IntelligentNewsDraft $draft): void
    {
        abort_unless((int) $draft->created_by === (int) $request->user()->getKey(), 403);
    }

    private function publishPlatforms(): array
    {
        return app(MetaConnections::class)->platforms(auth()->id());
    }

    private function categories(): array
    {
        return NewsCategory::active()->orderBy('display_order')->orderBy('name')
            ->get(['categoryID', 'name'])->all();
    }
}
