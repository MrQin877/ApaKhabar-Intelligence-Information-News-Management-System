<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NewsCreatorController extends Controller
{
    public function documents(): Response
    {
        return Inertia::render('admin/intelligentnewscreator/docarchive');
    }

    public function create(Request $request): Response
    {
        return Inertia::render('admin/intelligentnewscreator/newscreator', [
            'selectedDocId' => $request->integer('doc') ?: null,
        ]);
    }
}