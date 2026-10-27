<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SyncMetaInsights;
use App\Models\AnalyticsSetting;
use App\Models\SocialConnection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MetaAnalyticsController extends Controller
{
    public function update(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $data = $request->validate(['connection_ids' => ['present', 'array', 'max:2'], 'connection_ids.*' => ['integer', 'distinct', Rule::exists('social_connections', 'id')->where('user_id', $request->user()->getKey())]]);
        $connections = SocialConnection::whereIn('id', $data['connection_ids'])->get();
        if ($connections->pluck('platform')->unique()->count() !== $connections->count()) {
            throw ValidationException::withMessages(['connection_ids' => 'Pilih satu akun per platform.']);
        }
        DB::transaction(function () use ($data, $request) {
            AnalyticsSetting::current()->update(['meta_connection_ids' => $data['connection_ids'], 'updated_by' => $request->user()->getKey()]);
            DB::table('analytics_setting_changes')->insert(['user_id' => $request->user()->getKey(), 'configuration' => json_encode($data), 'created_at' => now()]);
        });
        SyncMetaInsights::dispatch();

        return back();
    }

    public function sync(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
        SyncMetaInsights::dispatch();

        return back();
    }
}
