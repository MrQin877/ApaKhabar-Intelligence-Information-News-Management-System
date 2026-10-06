<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\NewsCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class NewsCategoryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/categories/index', ['categories' => $this->categoryData(false)]);
    }

    public function active(): JsonResponse
    {
        return response()->json(['categories' => $this->categoryData(true)]);
    }

    public function all(Request $request): JsonResponse
    {
        $this->requireManager($request);

        return response()->json(['categories' => $this->categoryData(false)]);
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $this->requireManager($request);
        $data = $this->validated($request);
        $category = NewsCategory::create([
            ...$data,
            'slug' => $this->uniqueSlug($data['name']),
            'created_by' => $request->user()->getKey(),
        ]);

        return $request->expectsJson()
            ? response()->json(['category' => $category->fresh(), 'categories' => $this->categoryData(true)], 201)
            : back()->with('success', 'Kategori berhasil ditambahkan.');
    }

    public function update(Request $request, NewsCategory $category): RedirectResponse|JsonResponse
    {
        $this->requireManager($request);
        $data = $this->validated($request, $category);
        $category->update([
            ...$data,
            'slug' => $this->uniqueSlug($data['name'], $category),
        ]);

        return $request->expectsJson()
            ? response()->json(['category' => $category->fresh()])
            : back()->with('success', 'Kategori berhasil diperbarui.');
    }

    public function destroy(Request $request, NewsCategory $category): RedirectResponse|JsonResponse
    {
        $this->requireManager($request);
        $category->delete();

        return $request->expectsJson()
            ? response()->json(status: 204)
            : back()->with('success', 'Kategori berhasil dihapus.');
    }

    public function reorder(Request $request): RedirectResponse|JsonResponse
    {
        $this->requireManager($request);
        $data = $request->validate([
            'ids' => ['required', 'array', 'list', 'min:1', 'max:9999'],
            'ids.*' => ['required', 'integer', 'distinct'],
            'original_ids' => ['required', 'array', 'list', 'min:1', 'max:9999'],
            'original_ids.*' => ['required', 'integer', 'distinct'],
        ]);
        DB::transaction(function () use ($data) {
            $categories = NewsCategory::orderBy('display_order')->orderBy('name')->lockForUpdate()->get();
            $current = $categories->modelKeys();
            $original = array_map('intval', $data['original_ids']);
            $ids = array_map('intval', $data['ids']);
            if ($current !== $original || count($ids) !== count($current) || array_diff($ids, $current)) {
                throw ValidationException::withMessages(['ids' => 'Daftar kategori telah berubah. Muat ulang halaman sebelum mengatur urutan.']);
            }
            foreach ($ids as $index => $id) {
                NewsCategory::whereKey($id)->update(['display_order' => $index + 1]);
            }
        });

        return $request->expectsJson()
            ? response()->json(['categories' => $this->categoryData(false)])
            : back()->with('success', 'Urutan navigasi berhasil disimpan.');
    }

    private function validated(Request $request, ?NewsCategory $category = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'in:active,inactive'],
            'is_active' => ['sometimes', 'boolean'],
            'display_order' => ['sometimes', 'integer', 'min:0', 'max:9999'],
        ]);
        $duplicate = NewsCategory::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($data['name']))])
            ->when($category, fn ($query) => $query->whereKeyNot($category->getKey()))
            ->exists();
        if ($duplicate) {
            throw ValidationException::withMessages(['name' => 'Nama kategori sudah digunakan.']);
        }
        $data['name'] = trim($data['name']);
        if (mb_strtolower($data['name']) === 'lainnya') {
            throw ValidationException::withMessages(['name' => 'Gunakan Tanpa kategori untuk berita yang tidak memiliki kategori.']);
        }

        return $data;
    }

    private function uniqueSlug(string $name, ?NewsCategory $ignore = null): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $suffix = 2;
        while (NewsCategory::withTrashed()->where('slug', $slug)->when($ignore, fn ($q) => $q->whereKeyNot($ignore->getKey()))->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }

    private function categoryData(bool $activeOnly): array
    {
        return NewsCategory::query()
            ->when($activeOnly, fn ($query) => $query->active())
            ->withCount(['news', 'drafts'])
            ->orderBy('display_order')->orderBy('name')
            ->get()->map(fn ($category) => [
                'id' => $category->getKey(), 'name' => $category->name, 'slug' => $category->slug,
                'description' => $category->description, 'status' => $category->status,
                'display_order' => $category->display_order, 'is_default' => $category->is_default,
                'articles_count' => $category->news_count + $category->drafts_count,
            ])->all();
    }

    private function requireManager(Request $request): void
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isModerator(), 403);
    }
}
