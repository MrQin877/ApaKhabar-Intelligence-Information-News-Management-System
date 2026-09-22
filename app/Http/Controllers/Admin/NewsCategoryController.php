<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\NewsCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
        $this->requireAdmin($request);

        return response()->json(['categories' => $this->categoryData(false)]);
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $this->requireAdmin($request);
        $data = $this->validated($request);
        $category = NewsCategory::create([
            ...$data,
            'slug' => $this->uniqueSlug($data['name']),
            'status' => 'active',
            'created_by' => $request->user()->getKey(),
        ]);

        return $request->expectsJson()
            ? response()->json(['category' => $category], 201)
            : back()->with('success', 'Kategori berhasil ditambahkan.');
    }

    public function update(Request $request, NewsCategory $category): RedirectResponse|JsonResponse
    {
        $this->requireAdmin($request);
        $data = $this->validated($request, $category);
        if ($category->is_default && ($data['status'] ?? 'active') === 'inactive') {
            throw ValidationException::withMessages(['status' => 'Kategori bawaan harus tetap aktif.']);
        }
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
        $this->requireAdmin($request);
        if ($category->is_default) {
            throw ValidationException::withMessages(['category' => 'Kategori bawaan tidak dapat dihapus.']);
        }
        if ($category->news()->exists() || $category->drafts()->exists()) {
            throw ValidationException::withMessages([
                'category' => 'Kategori masih digunakan. Pindahkan artikelnya atau nonaktifkan kategori ini.',
            ]);
        }
        $category->delete();

        return $request->expectsJson()
            ? response()->json(status: 204)
            : back()->with('success', 'Kategori berhasil dihapus.');
    }

    private function validated(Request $request, ?NewsCategory $category = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'in:active,inactive'],
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

        return $data;
    }

    private function uniqueSlug(string $name, ?NewsCategory $ignore = null): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $suffix = 2;
        while (NewsCategory::where('slug', $slug)->when($ignore, fn ($q) => $q->whereKeyNot($ignore->getKey()))->exists()) {
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

    private function requireAdmin(Request $request): void
    {
        abort_unless($request->user()?->isAdmin(), 403);
    }
}
