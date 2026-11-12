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
        $broadcasts = Broadcast::publicEmergency()->get();
        $latest = $broadcasts->first();

        return response()->json([
            'message' => $latest ? $latest->title . ': ' . $latest->message : null,
            'broadcasts' => $broadcasts->map->publicEmergencyData()->values(),
        ])->header('Cache-Control', 'no-store');
    }
}
