<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsSession;
use App\Models\News;
use App\Models\NewsCategory;
use App\Services\News\ArticleHtml;
use App\Services\News\MetaConnections;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
            ->whereIn('status', ['draft', 'archived'])
            ->latest('updated_at')
            ->get()
            ->map(function (IntelligentNewsDraft $draft) {
                $quality = $draft->qualityEvaluations->first();

                return [
                    'key' => "draft-{$draft->id}",
                    'id' => $draft->id,
                    'record_type' => 'draft',
                    'title' => $draft->headline,
                    'summary' => $draft->summary,
                    'status' => $draft->status,
                    'creation_method' => $draft->creation_method,
                    'category' => $draft->category?->name,
                    'updated_at' => $draft->updated_at?->toISOString(),
                    'resume_url' => $draft->creation_method === 'ai'
                        ? route('admin.assistant.index', array_filter([
                            'session' => $draft->session?->id,
                            'draft' => $draft->id,
                        ]))
                        : route('admin.news-workspace.manual.edit', $draft),
                    'can_publish' => $draft->status === 'draft' && ! $quality?->publish_blocked,
                    'quality_score' => $quality?->overall_score,
                    'quality_label' => $quality?->quality_label,
                    'publish_blocked' => $quality?->publish_blocked ?? false,
                ];
            });

        $sessions = IntelligentNewsSession::query()
            ->where('created_by', $userId)
            ->whereNull('draft_id')
            ->latest('updated_at')
            ->get()
            ->map(fn (IntelligentNewsSession $session) => [
                'key' => "session-{$session->id}",
                'id' => $session->id,
                'record_type' => 'session',
                'title' => $session->prompt ?: 'Percakapan AI tanpa judul',
                'summary' => count($session->pending_questions ?? []).' informasi masih diperlukan',
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

        $published = News::query()
            ->with('categoryRecord:categoryID,name')
            ->latest('updated_at')
            ->get()
            ->map(fn (News $news) => [
                'key' => "news-{$news->getKey()}",
                'id' => $news->getKey(),
                'record_type' => 'news',
                'title' => $news->title,
                'summary' => $news->excerpt ?: str($news->content)->stripTags()->limit(180)->toString(),
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

    public function store(Request $request): RedirectResponse
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
                'headline' => $draft->headline,
                'subheadline' => $draft->subheadline,
                'content' => collect($draft->body)->join("\n\n"),
                'content_html' => app(ArticleHtml::class)->sanitize(
                    preg_match('/<(p|div|br|strong|b|em|i|u|ul|ol|li|blockquote)\b/i', collect($draft->body)->join("\n\n"))
                        ? collect($draft->body)->join("\n\n")
                        : nl2br(e(collect($draft->body)->join("\n\n")))
                ),
                'summary' => $draft->summary,
                'category_id' => $draft->category_id,
                'image' => $draft->image,
                'status' => $draft->status,
                'show_on_homepage' => $draft->show_on_homepage,
            ],
            'categories' => $this->categories(),
            'publishPlatforms' => $this->publishPlatforms(),
            'metaAuth' => app(MetaConnections::class)->publicConfig(),
        ]);
    }

    public function update(Request $request, IntelligentNewsDraft $draft): RedirectResponse
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

    public function publish(Request $request, IntelligentNewsDraft $draft): RedirectResponse
    {
        $this->authorizeDraft($request, $draft);
        abort_unless($draft->status === 'draft', 422, 'Only draft content can be published.');
        abort_unless($draft->reviewed_at !== null, 422, 'Review the current draft version before publishing.');
        $latestQuality = $draft->qualityEvaluations()->first();
        abort_if(
            $draft->creation_method === 'ai' && $latestQuality?->publish_blocked,
            422,
            'Resolve unsupported, contradicted, or unsafe content before publishing.',
        );

        DB::transaction(function () use ($request, $draft) {
            $news = News::create([
                'title' => $draft->headline,
                'content' => collect($draft->body)->join("\n\n"),
                'excerpt' => $draft->summary,
                'image' => $draft->image,
                'category_id' => $draft->category_id,
                'status' => 'active',
                'creation_method' => $draft->creation_method,
                'created_by' => $request->user()->getKey(),
                'show_on_homepage' => $draft->show_on_homepage,
            ]);
            $draft->update(['status' => 'published', 'published_news_id' => $news->getKey()]);
        });

        return redirect()->route('admin.news-workspace.index')->with('success', 'Berita berhasil dipublikasikan.');
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
        $data = $request->validate([
            'headline' => ['required', 'string', 'max:255'],
            'subheadline' => ['nullable', 'string', 'max:255'],
            'content' => ['required', 'string', 'min:20', 'max:100000'],
            'summary' => ['required', 'string', 'max:1000'],
            'category_id' => ['nullable', 'integer', Rule::exists('news_categories', 'categoryID')],
            'image' => ['nullable', 'url', 'max:2048'],
            'cover_photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
            'show_on_homepage' => ['sometimes', 'boolean'],
            'content_format' => ['sometimes', Rule::in(['html', 'text'])],
            'intent' => ['sometimes', Rule::in(['draft', 'publish'])],
            'platforms' => ['exclude_unless:intent,publish', 'required', 'array', 'min:1', 'max:3'],
            'platforms.*' => ['string', 'distinct', Rule::in(['website', 'facebook', 'instagram'])],
        ]);

        if (($data['intent'] ?? 'draft') === 'publish' && array_diff($data['platforms'], ['website'])) {
            $available = collect($this->publishPlatforms())->where('status', 'connected')->pluck('id')->all();
            $message = array_diff($data['platforms'], $available)
                ? 'Platform yang dipilih belum terhubung. Hubungkan akun terlebih dahulu.'
                : 'Koneksi akun tersimpan, tetapi penerbitan ke media sosial belum diaktifkan. Pilih Website untuk menerbitkan saat ini.';
            throw ValidationException::withMessages(['platforms' => $message]);
        }

        if (($data['content_format'] ?? 'text') === 'html') {
            $data['content'] = app(ArticleHtml::class)->sanitize($data['content']);
            if (mb_strlen(trim(html_entity_decode(strip_tags($data['content'])))) < 20) {
                throw ValidationException::withMessages(['content' => 'Isi berita harus berisi setidaknya 20 karakter teks.']);
            }
        }

        if ($request->hasFile('cover_photo')) {
            $disk = config('filesystems.news_media_disk', 'public');
            $path = $request->file('cover_photo')->storePublicly('news-images', $disk);
            if (! $path) {
                throw ValidationException::withMessages(['cover_photo' => 'Gambar gagal disimpan. Silakan coba lagi.']);
            }
            $data['image'] = url(Storage::disk($disk)->url($path));
        }

        return $data;
    }

    private function draftAttributes(array $data, int $userId): array
    {
        $paragraphs = collect(preg_split('/\R{2,}/', trim($data['content'])))
            ->map(fn ($paragraph) => trim($paragraph))->filter()->values()->all();

        return [
            'created_by' => $userId,
            'creation_method' => 'manual',
            'category_id' => $data['category_id'] ?? null,
            'image' => $data['image'] ?? null,
            'headline' => $data['headline'],
            'subheadline' => $data['subheadline'] ?? null,
            'lead' => $paragraphs[0],
            'body' => $paragraphs,
            'summary' => $data['summary'],
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
