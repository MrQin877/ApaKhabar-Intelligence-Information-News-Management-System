<?php

/**
 * EmergencyBroadcastController.php
 *
 * This controller handles the retrieval of emergency broadcast messages.
 * It provides an endpoint to fetch the latest emergency broadcast sent within
 * the last 24 hours.
 *
 * Used for Home/public display.
 */

namespace App\Http\Controllers\Home;

use App\Http\Controllers\Controller;
use App\Models\Broadcast;

class EmergencyBroadcastController extends Controller
{
    public function darurat()
    {
        $broadcast = Broadcast::whereHas('categoryRecord', fn ($query) => $query->where('name', 'darurat'))
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