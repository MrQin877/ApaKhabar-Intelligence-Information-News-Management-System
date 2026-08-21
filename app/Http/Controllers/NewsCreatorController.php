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

    public function create()
    {
        return inertia('admin/intelligentnewscreator/newscreator');
    }

    public function archive()
    {
        return inertia('admin/intelligentnewscreator/docarchive', [
            // 'documents' => Document::latest()->get(), // wire up real data later
        ]);
    }
}