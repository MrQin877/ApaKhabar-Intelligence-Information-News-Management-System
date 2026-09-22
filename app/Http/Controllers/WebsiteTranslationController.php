<?php

namespace App\Http\Controllers;

use App\Services\WebsiteTranslation;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Request;
use RuntimeException;

class WebsiteTranslationController extends Controller
{
    public function __invoke(Request $request, WebsiteTranslation $translator)
    {
        $data = $request->validate([
            'target' => ['required', 'in:en,id'],
            'texts' => ['required', 'array', 'min:1', 'max:20'],
            'texts.*' => ['required', 'string', 'max:3000'],
        ]);
        abort_if(array_sum(array_map('mb_strlen', $data['texts'])) > 12000, 422, 'Translation batch is too large.');
        try {
            return response()->json(['translations' => $translator->translate($data['texts'], $data['target'])])
                ->header('Cache-Control', 'private, no-store');
        } catch (ConnectionException|RequestException|RuntimeException $exception) {
            // Do not expose upstream errors, credentials, or submitted page content.
            return response()->json(['message' => 'Translation is temporarily unavailable.'], 503);
        }
    }
}
