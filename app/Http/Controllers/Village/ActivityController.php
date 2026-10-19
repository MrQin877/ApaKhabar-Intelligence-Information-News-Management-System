<?php

namespace App\Http\Controllers\Village;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ActivityController extends Controller
{
    public function store(Request $request)
    {
        abort_unless($request->user()?->isVillager(), 403);
        $request->validate(['event' => ['required', Rule::in(['feed_open', 'post_open'])]]);
        // Ignore client timestamps and platform claims; mobile must authenticate with its API token.
        DB::table('villager_activity_hours')->insertOrIgnore(['user_id' => $request->user()->getKey(), 'hour' => now('UTC')->startOfHour(), 'platform' => $request->is('api/*') ? 'mobile' : 'web']);

        return response()->noContent();
    }
}
