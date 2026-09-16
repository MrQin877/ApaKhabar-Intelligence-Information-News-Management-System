<?php

use App\Http\Controllers\Admin\BroadcastController;
use App\Http\Controllers\Admin\NewsCreatorController;
use App\Http\Controllers\Admin\NewsWorkspaceController;
use App\Http\Controllers\Auth\MobileEmailVerificationController;
use App\Http\Controllers\Home\WelcomeController;
use App\Http\Controllers\News\CommentController;
use App\Http\Controllers\News\NewsController;
use App\Http\Controllers\News\PostLikeController;
use App\Http\Controllers\Village\NotificationController;
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

        // News creator routes
        Route::get('/apakhabar-creator', [NewsWorkspaceController::class, 'index'])->name('creator.index');
        Route::get('/apakhabar-creator/manual/create', [NewsWorkspaceController::class, 'create'])->name('creator.manual.create');
        Route::post('/apakhabar-creator/manual', [NewsWorkspaceController::class, 'store'])->name('creator.manual.store');
        Route::get('/apakhabar-creator/manual/{draft}/edit', [NewsWorkspaceController::class, 'edit'])->name('creator.manual.edit');
        Route::put('/apakhabar-creator/manual/{draft}', [NewsWorkspaceController::class, 'update'])->name('creator.manual.update');
        Route::post('/apakhabar-creator/drafts/{draft}/publish', [NewsWorkspaceController::class, 'publish'])->name('creator.drafts.publish');
        Route::post('/apakhabar-creator/{type}/{id}/archive', [NewsWorkspaceController::class, 'archive'])->name('creator.items.archive');
        Route::post('/apakhabar-creator/{type}/{id}/restore', [NewsWorkspaceController::class, 'restore'])->name('creator.items.restore');
        Route::get('/apakhabar-creator/documents', [NewsCreatorController::class, 'documents'])->name('creator.documents');
        Route::get('/apakhabar-creator/create', [NewsCreatorController::class, 'create'])->name('creator.create');
        Route::post('/apakhabar-creator/documents', [NewsCreatorController::class, 'storeDocument'])->name('creator.documents.store');
        Route::post('/apakhabar-creator/generate', [NewsCreatorController::class, 'generate'])->name('creator.generate');
        Route::post('/apakhabar-creator/recommendations', [NewsCreatorController::class, 'recommend'])->name('creator.recommendations');
        Route::get('/apakhabar-creator/archive', [NewsCreatorController::class, 'archive'])->name('creator.archive');
    });

// Post-login redirect — Fortify lands here, bounce by role

Route::get('/dashboard', function () {
    return match (auth()->user()->role) {
        'admin', 'moderator' => redirect()->route('admin.dashboard'),
        default => redirect()->route('home'),
    };
})->middleware('auth', 'verified')->name('dashboard');

require __DIR__.'/settings.php';
