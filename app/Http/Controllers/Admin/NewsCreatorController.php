<?php

/**
 * NewsCreatorController.php
 *
 * This controller manages the creation and archiving of news documents.
 * It provides endpoints for rendering the news creator interface and the
 * document archive view.
 *
 * Used for Admin Panel endpoints.
 */

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
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