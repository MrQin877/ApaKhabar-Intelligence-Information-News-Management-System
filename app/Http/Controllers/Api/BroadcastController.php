<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Broadcast;

class BroadcastController extends Controller
{
    public function darurat()
    {
        $broadcast = Broadcast::where('category', 'darurat')
            ->where('status', 'dikirim')
            ->whereNull('archived_at')
            ->where('sent_at', '>=', now()->subHours(24))  // ← only within 24 hours
            ->latest('sent_at')
            ->first();

        if (!$broadcast) {
            return response()->json(['message' => null]);
        }

        return response()->json([
            'message' => $broadcast->title . ': ' . $broadcast->message,
        ]);
    }
}