<?php

use App\Http\Controllers\Admin\AssistantCategoryController;
use App\Http\Controllers\Admin\BroadcastController;
use App\Http\Controllers\Admin\CommentModerationController;
use App\Http\Controllers\Admin\MetaConnectionController;
use App\Http\Controllers\Admin\NewsCategoryController;
use App\Http\Controllers\Admin\NewsCreatorController;
use App\Http\Controllers\Admin\NewsWorkspaceController;
use App\Http\Controllers\Admin\ShortVideoController;
use App\Http\Controllers\Auth\MobileEmailVerificationController;
use App\Http\Controllers\Home\WelcomeController;
use App\Http\Controllers\News\CommentController;
use App\Http\Controllers\News\EngagementController;
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

Route::get('/news/{id}/engagement', [EngagementController::class, 'context'])->middleware('throttle:30,1');
Route::post('/news/{id}/view', [EngagementController::class, 'view'])->middleware('throttle:30,1');
Route::post('/news/{id}/comment', [CommentController::class, 'store'])->middleware('throttle:5,1')->name('news.comment');
Route::middleware(['auth', 'throttle:30,1'])->group(function () {
    Route::post('/news/{id}/like', [PostLikeController::class, 'store'])->name('news.like');
    Route::post('/comments/{id}/like', [CommentController::class, 'like'])->name('comments.like');
    Route::post('/comments/{id}/report', [EngagementController::class, 'report'])->name('comments.report');
    Route::post('/comments/{id}/replies', [CommentController::class, 'reply'])->middleware('throttle:5,1')->name('comments.reply');
});

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
    Route::get('/profile', fn () => inertia('villager/profile'))->name('villager.profile');

});

// Article moderation data is never included in public article responses.
Route::middleware(['auth', 'verified', 'throttle:30,1'])->prefix('admin/news/{news}/moderation-comments')->group(function () {
    Route::get('/', [\App\Http\Controllers\Admin\ModerationFeedbackController::class, 'index']);
    Route::get('/{comment}', [\App\Http\Controllers\Admin\ModerationFeedbackController::class, 'show']);
    Route::post('/{comment}/feedback', [\App\Http\Controllers\Admin\ModerationFeedbackController::class, 'store']);
});

// Admin portal — admin and moderator only

Route::get('/admin', fn () => redirect()->route('admin.dashboard'))
    ->middleware(['auth', 'role:admin,moderator']);

Route::prefix('admin')
    ->name('admin.')
    ->middleware(['auth', 'verified', 'role:admin,moderator'])
    ->group(function () {
        Route::get('/social/connections', [MetaConnectionController::class, 'status'])->middleware('throttle:30,1')->name('social.status');
        Route::get('/social/facebook/connect', [MetaConnectionController::class, 'facebookStart'])->middleware('throttle:10,1')->block(10, 10)->name('social.facebook.start');
        Route::get('/social/facebook/callback', [MetaConnectionController::class, 'facebookCallback'])->block(10, 10)->name('social.facebook.callback');
        Route::post('/social/facebook/cancel', [MetaConnectionController::class, 'cancelSelection'])->block(10, 10)->name('social.facebook.cancel');
        Route::post('/social/{platform}/disconnect', [MetaConnectionController::class, 'disconnect'])->middleware('throttle:10,1')->block(10, 10)->name('social.disconnect');
        Route::post('/social/facebook/page', [MetaConnectionController::class, 'chooseAccount'])->middleware('throttle:10,1')->block(10, 10)->name('social.facebook.page');
        Route::post('/social/meta/account', [MetaConnectionController::class, 'chooseAccount'])->middleware('throttle:10,1')->block(10, 10)->name('social.meta.account');
        Route::post('/social/meta/cancel', [MetaConnectionController::class, 'cancelSelection'])->block(10, 10)->name('social.meta.cancel');
        Route::get('/social/instagram/connect', [MetaConnectionController::class, 'instagramStart'])->middleware('throttle:10,1')->block(10, 10)->name('social.instagram.start');
        Route::get('/social/instagram/callback', [MetaConnectionController::class, 'instagramCallback'])->block(10, 10)->name('social.instagram.callback');
        Route::inertia('/dashboard', 'admin/dashboard')->name('dashboard');
        Route::get('/short-videos', [ShortVideoController::class, 'index'])->name('short-videos.index');
        Route::get('/short-videos/create', [ShortVideoController::class, 'create'])->name('short-videos.create');
        Route::post('/short-videos/upload', [ShortVideoController::class, 'upload'])->middleware('throttle:10,1');
        Route::post('/short-videos/{shortVideo}', [ShortVideoController::class, 'update']);
        Route::post('/short-videos/{shortVideo}/preview', [ShortVideoController::class, 'preview']);
        Route::post('/short-videos/{shortVideo}/publish', [ShortVideoController::class, 'publish'])->middleware('throttle:10,1');
        Route::get('/short-videos/{shortVideo}/status', [ShortVideoController::class, 'status']);
        Route::post('/short-videos/{shortVideo}/retry/{platform}', [ShortVideoController::class, 'retry'])->middleware('throttle:10,1');
        Route::post('/short-videos/{shortVideo}/retry-selected', [ShortVideoController::class, 'retrySelected'])->middleware('throttle:10,1');
        Route::post('/short-videos/{shortVideo}/restore', [ShortVideoController::class, 'restore']);
        Route::post('/short-videos/{shortVideo}/archive', [ShortVideoController::class, 'archive']);
        Route::post('/short-videos/{shortVideo}/delete', [ShortVideoController::class, 'destroy']);
        Route::get('/comments', [CommentModerationController::class, 'index'])->name('comments.index');
        Route::post('/comments/{id}/decision', [CommentModerationController::class, 'decide'])->middleware('throttle:30,1')->name('comments.decision');

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
        Route::post('/ai-assistant/category-proposals/{message}', [AssistantCategoryController::class, 'decide'])->name('assistant.category-decision');
        Route::get('/ai-assistant', [NewsCreatorController::class, 'create'])->name('assistant.index');
        Route::get('/ai-assistant/runs/{requestId}', [NewsCreatorController::class, 'agentProgress'])->name('assistant.progress');
        Route::post('/ai-assistant/runs/{requestId}/stop', [NewsCreatorController::class, 'stopGeneration'])->name('assistant.stop');
        Route::post('/ai-assistant/generate-async', [NewsCreatorController::class, 'generateAsync'])->name('assistant.generate-async');
        Route::get('/ai-assistant/documents/{document}/progress', [NewsCreatorController::class, 'documentProgress'])->name('assistant.document-progress');
        Route::post('/ai-assistant/generate', [NewsCreatorController::class, 'generate'])->name('assistant.generate');
        Route::post('/ai-assistant/recommendations', [NewsCreatorController::class, 'recommend'])->name('assistant.recommendations');
        Route::put('/ai-assistant/drafts/{draft}', [NewsCreatorController::class, 'updateDraft'])->name('assistant.drafts.update');
        Route::post('/ai-assistant/drafts/{draft}/approve-conflict', [NewsCreatorController::class, 'approveConflict'])->name('assistant.drafts.approve-conflict');
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
        Route::post('/news/manual/preview', [NewsWorkspaceController::class, 'preview'])->name('news-workspace.manual.preview');
        Route::post('/news/manual', [NewsWorkspaceController::class, 'store'])->name('news-workspace.manual.store');
        Route::get('/news/manual/{draft}/edit', [NewsWorkspaceController::class, 'edit'])->name('news-workspace.manual.edit');
        Route::put('/news/manual/{draft}', [NewsWorkspaceController::class, 'update'])->name('news-workspace.manual.update');
        Route::post('/news/drafts/{draft}/preview', [NewsWorkspaceController::class, 'previewAi'])->name('news-workspace.drafts.preview');
        Route::post('/news/drafts/{draft}/crops', [NewsWorkspaceController::class, 'cropAi'])->name('news-workspace.drafts.crops');
        Route::post('/news/drafts/{draft}/publish', [NewsWorkspaceController::class, 'publish'])->name('news-workspace.drafts.publish');
        Route::post('/news/drafts/{draft}/retry', [NewsWorkspaceController::class, 'retry'])->name('news-workspace.drafts.retry');
        Route::delete('/news/{type}/{id}', [NewsWorkspaceController::class, 'destroyDraft'])->whereIn('type', ['draft', 'session'])->name('news-workspace.items.destroy');
        Route::post('/news/{type}/{id}/archive', [NewsWorkspaceController::class, 'archive'])->name('news-workspace.items.archive');
        Route::post('/news/{type}/{id}/restore', [NewsWorkspaceController::class, 'restore'])->name('news-workspace.items.restore');

        // Compatibility for existing bookmarks and saved links.
        Route::get('/apakhabar-creator', fn () => redirect()->route('admin.news-workspace.index'));
        Route::get('/apakhabar-creator/create', fn (Request $request) => redirect()->route('admin.assistant.index', $request->query()));
        Route::get('/apakhabar-creator/documents', fn () => redirect()->route('admin.documents.index'));
        Route::get('/apakhabar-creator/archive', fn () => redirect()->route('admin.documents.index'));

        Route::middleware('role:admin,moderator')->group(function () {
            Route::post('/categories/reorder', [NewsCategoryController::class, 'reorder'])->name('categories.reorder');
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
