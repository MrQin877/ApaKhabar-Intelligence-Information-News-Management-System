<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IntelligentNewsDraft;
use App\Models\IntelligentNewsDraftVersion;
use App\Models\IntelligentNewsMessage;
use App\Models\NewsCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AssistantCategoryController extends Controller
{
    public function decide(Request $request, IntelligentNewsMessage $message)
    {
        abort_unless($message->session->created_by === $request->user()->getKey(), 403);
        $message->session->assertWritable();
        $data = $request->validate(['decision' => ['required', 'in:approve,existing,cancel'],
            'category_id' => ['required_if:decision,existing', 'nullable', 'integer']]);
        abort_if($data['decision'] === 'approve' && ! $request->user()->isAdmin(), 403);
        Cache::lock('assistant-category-decisions', 15)->block(5, function () use ($message, $request, $data) {
            DB::transaction(function () use ($message, $request, $data) {
                $message = IntelligentNewsMessage::whereKey($message->id)->lockForUpdate()->firstOrFail();
                $payload = $message->payload;
                $proposal = $payload['category_proposal'] ?? null;
                abort_unless($proposal, 422);
                if ($proposal['status'] !== 'pending') {
                    return;
                }
                if ($data['decision'] !== 'cancel') {
                    $draft = IntelligentNewsDraft::where('created_by', $request->user()->getKey())
                        ->where('status', 'draft')->whereKey($proposal['draft_id'])->lockForUpdate()->firstOrFail();
                    abort_unless($draft->version === $proposal['draft_version'], 409, 'Draf telah berubah. Tinjau kategori pada versi terbaru.');
                    if ($data['decision'] === 'existing') {
                        $category = NewsCategory::active()->findOrFail($data['category_id']);
                    } else {
                        $name = trim($proposal['name']);
                        $slug = Str::slug($name) ?: 'category';
                        $category = NewsCategory::whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower($name)])->first();
                        abort_if($category && $category->status !== 'active', 422, 'Kategori ini tidak aktif. Pilih kategori aktif.');
                        if (! $category) {
                            $base = $slug;
                            $suffix = 2;
                            while (NewsCategory::where('slug', $slug)->exists()) {
                                $slug = $base.'-'.$suffix++;
                            }
                            $category = NewsCategory::create(['name' => $name, 'slug' => $slug, 'description' => $proposal['reason'],
                                'status' => 'active', 'created_by' => $request->user()->getKey()]);
                        }
                    }
                    $draft->update(['category_id' => $category->getKey(), 'version' => $draft->version + 1, 'reviewed_at' => null]);
                    IntelligentNewsDraftVersion::create(['draft_id' => $draft->id, 'version' => $draft->version,
                        'change_type' => 'edited', 'revision_source' => 'manual', 'created_by' => $request->user()->getKey(),
                        'snapshot' => $draft->only(['headline', 'subheadline', 'lead', 'body', 'summary', 'labels', 'sources_used', 'warnings', 'category_id', 'image', 'user_prompt'])]);
                }
                $proposal['status'] = $data['decision'];
                $proposal['decided_by'] = $request->user()->getKey();
                $payload['category_proposal'] = $proposal;
                $message->update(['payload' => $payload]);
            });
        });

        return back()->with('success', 'Keputusan kategori disimpan.');
    }
}
