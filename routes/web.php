<?php

use App\Http\Controllers\Admin\BroadcastController;
use App\Http\Controllers\Admin\NewsCategoryController;
use App\Http\Controllers\Admin\NewsCreatorController;
use App\Http\Controllers\Admin\NewsWorkspaceController;
use App\Http\Controllers\Auth\MobileEmailVerificationController;
use App\Http\Controllers\Home\WelcomeController;
use App\Http\Controllers\News\CommentController;
use App\Http\Controllers\News\NewsController;
use App\Http\Controllers\News\PostLikeController;
use App\Http\Controllers\Village\NotificationController;
use App\Http\Controllers\WebsiteTranslationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/mobile/email/verify/{id}/{hash}', [MobileEmailVerificationController::class, 'verify'])
    ->middleware('throttle:30,1')->name('mobile.verification.verify');

// Browser entry point for password-reset emails sent by the mobile API.
Route::get('/mobile/reset-password', function (Request $request) {
    $parameters = $request->validate([
        'token' => ['required', 'string'],
        'email' => ['required', 'email'],
    ]);
    $destination = config('services.mobile.password_reset_return_url');
    $separator = str_contains($destination, '?') ? '&' : '?';
    $query = http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);

    return redirect()->away($destination.$separator.$query)
        ->header('Referrer-Policy', 'no-referrer')
        ->header('Cache-Control', 'no-store');
})->name('mobile.password.reset');

Route::post('/website/translate', WebsiteTranslationController::class)
    ->middleware('throttle:60,1')->name('website.translate');

// Public routes — no auth required

Route::get('/', [WelcomeController::class, 'index'])->name('home');

Route::get('/news', [NewsController::class, 'index'])->name('news.index');

Route::get('/news/{id}', [NewsController::class, 'show'])->name('news.show');

// Authenticated routes — login required for all but shared between villager and admin
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/notifications', [NotificationController::class, 'index'])
        ->name('notifications.index');
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead'])
        ->name('notifications.read-all');
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead'])
        ->name('notifications.read');
});

// Villager authenticated routes — login required for engagement

Route::middleware(['auth', 'verified', 'role:villager'])->group(function () {
    Route::post('/news/{id}/like', [PostLikeController::class, 'store'])->name('news.like');
    Route::post('/news/{id}/comment', [CommentController::class, 'store'])->name('news.comment');
    Route::post('/comments/{id}/replies', [CommentController::class, 'reply'])->name('comments.reply');
    Route::get('/profile', fn () => inertia('villager/profile'))->name('villager.profile');

});

// Admin portal — admin and moderator only

Route::get('/admin', fn () => redirect()->route('admin.dashboard'))
    ->middleware(['auth', 'role:admin,moderator']);

Route::prefix('admin')
    ->name('admin.')
    ->middleware(['auth', 'verified', 'role:admin,moderator'])
    ->group(function () {
        Route::inertia('/dashboard', 'admin/dashboard')->name('dashboard');

        // Broadcasting — full CRUD + archive/restore
        Route::get('/broadcasting', [BroadcastController::class, 'index'])->name('broadcasting.index');
        Route::get('/broadcasting/create', [BroadcastController::class, 'create'])->name('broadcasting.create');
        Route::post('/broadcasting', [BroadcastController::class, 'store'])->name('broadcasting.store');
        Route::get('/broadcasting/archived', [BroadcastController::class, 'archived'])->name('broadcasting.archived');
        Route::get('/broadcasting/{broadcast}', [BroadcastController::class, 'show'])->name('broadcasting.show');
        Route::post('/broadcasting/{broadcast}/resend', [BroadcastController::class, 'resend'])->name('broadcasting.resend');
        Route::post('/broadcasting/archive', [BroadcastController::class, 'archive'])->name('broadcasting.archive');
        Route::post('/broadcasting/{broadcast}/archive', [BroadcastController::class, 'archiveSingle'])->name('broadcasting.archive-single');
        Route::post('/broadcasting/{broadcast}/restore', [BroadcastController::class, 'restore'])->name('broadcasting.restore');

        // General AI assistant. News generation and document extraction are
        // capabilities of this workspace, not its navigation parent.
        Route::get('/ai-assistant', [NewsCreatorController::class, 'create'])->name('assistant.index');
        Route::get('/ai-assistant/runs/{requestId}', [NewsCreatorController::class, 'agentProgress'])->name('assistant.progress');
        Route::post('/ai-assistant/generate-async', [NewsCreatorController::class, 'generateAsync'])->name('assistant.generate-async');
        Route::get('/ai-assistant/documents/{document}/progress', [NewsCreatorController::class, 'documentProgress'])->name('assistant.document-progress');
        Route::post('/ai-assistant/generate', [NewsCreatorController::class, 'generate'])->name('assistant.generate');
        Route::post('/ai-assistant/recommendations', [NewsCreatorController::class, 'recommend'])->name('assistant.recommendations');
        Route::put('/ai-assistant/drafts/{draft}', [NewsCreatorController::class, 'updateDraft'])->name('assistant.drafts.update');
        Route::post('/ai-assistant/drafts/{draft}/review', [NewsCreatorController::class, 'reviewDraft'])->name('assistant.drafts.review');
        Route::post('/ai-assistant/drafts/{draft}/image', [NewsCreatorController::class, 'uploadDraftImage'])->name('assistant.drafts.image');

        // Independent document and extracted-information library.
        Route::get('/documents', [NewsCreatorController::class, 'documents'])->name('documents.index');
        Route::get('/documents/archived', [NewsCreatorController::class, 'archivedDocuments'])->name('documents.archived');
        Route::post('/documents', [NewsCreatorController::class, 'storeDocument'])->name('documents.store');
        Route::get('/documents/{document}/preview', [NewsCreatorController::class, 'previewDocument'])->name('documents.preview');
        Route::post('/documents/{document}/retry', [NewsCreatorController::class, 'retryDocument'])->name('documents.retry');
        Route::post('/documents/{document}/archive', [NewsCreatorController::class, 'archiveDocument'])->name('documents.archive');
        Route::post('/documents/{document}/restore', [NewsCreatorController::class, 'restoreDocument'])->name('documents.restore');
        Route::post('/information/{information}/review', [NewsCreatorController::class, 'reviewInformation'])->name('information.review');
        Route::post('/information/review/bulk', [NewsCreatorController::class, 'bulkReviewInformation'])->name('information.review.bulk');

        // News management, including manual drafts and AI-produced drafts.
        Route::get('/news', [NewsWorkspaceController::class, 'index'])->name('news-workspace.index');
        Route::get('/news/manual/create', [NewsWorkspaceController::class, 'create'])->name('news-workspace.manual.create');
        Route::post('/news/manual', [NewsWorkspaceController::class, 'store'])->name('news-workspace.manual.store');
        Route::get('/news/manual/{draft}/edit', [NewsWorkspaceController::class, 'edit'])->name('news-workspace.manual.edit');
        Route::put('/news/manual/{draft}', [NewsWorkspaceController::class, 'update'])->name('news-workspace.manual.update');
        Route::post('/news/drafts/{draft}/publish', [NewsWorkspaceController::class, 'publish'])->name('news-workspace.drafts.publish');
        Route::post('/news/{type}/{id}/archive', [NewsWorkspaceController::class, 'archive'])->name('news-workspace.items.archive');
        Route::post('/news/{type}/{id}/restore', [NewsWorkspaceController::class, 'restore'])->name('news-workspace.items.restore');

        // Compatibility for existing bookmarks and saved links.
        Route::get('/apakhabar-creator', fn () => redirect()->route('admin.news-workspace.index'));
        Route::get('/apakhabar-creator/create', fn (Request $request) => redirect()->route('admin.assistant.index', $request->query()));
        Route::get('/apakhabar-creator/documents', fn () => redirect()->route('admin.documents.index'));
        Route::get('/apakhabar-creator/archive', fn () => redirect()->route('admin.documents.index'));

        Route::middleware('role:admin')->group(function () {
            Route::get('/categories', [NewsCategoryController::class, 'index'])->name('categories.index');
            Route::post('/categories', [NewsCategoryController::class, 'store'])->name('categories.store');
            Route::put('/categories/{category}', [NewsCategoryController::class, 'update'])->name('categories.update');
            Route::delete('/categories/{category}', [NewsCategoryController::class, 'destroy'])->name('categories.destroy');
        });
    });

// Post-login redirect — Fortify lands here, bounce by role

Route::get('/dashboard', function () {
    return match (auth()->user()->role) {
        'admin', 'moderator' => redirect()->route('admin.dashboard'),
        default => redirect()->route('home'),
    };
})->middleware('auth', 'verified')->name('dashboard');

require __DIR__.'/settings.php';
