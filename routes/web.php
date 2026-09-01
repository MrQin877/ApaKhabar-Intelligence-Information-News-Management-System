<?php

use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;
use App\Http\Controllers\Admin\BroadcastController;
use App\Http\Controllers\Home\WelcomeController;
use App\Http\Controllers\News\CommentController;
use App\Http\Controllers\News\NewsController;
use App\Http\Controllers\News\PostLikeController;
use App\Http\Controllers\Village\NotificationController;
use App\Http\Controllers\Admin\NewsCreatorController;


// This route receives the click, then redirects to the mobile app.
Route::get('/mobile/reset-password', function (Illuminate\Http\Request $request) {
    $token = $request->query('token');
    $email = $request->query('email');
    $ip    = '192.168.68.56'; // ← replace with YOUR actual IP from ipconfig

    return redirect("exp://{$ip}:8081/--/reset-password?token={$token}&email={$email}");
});

//Public routes — no auth required

Route::get('/', [WelcomeController::class, 'index'])->name('home');

Route::get('/news', [NewsController::class, 'index'])->name('news.index');

Route::get('/news/{id}', [NewsController::class, 'show'])->name('news.show');


//Authenticated routes — login required for all but shared between villager and admin
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/notifications', [App\Http\Controllers\Village\NotificationController::class, 'index'])
        ->name('notifications.index');
    Route::patch('/notifications/read-all', [App\Http\Controllers\Village\NotificationController::class, 'markAllRead'])
        ->name('notifications.read-all');
    Route::patch('/notifications/{id}/read', [App\Http\Controllers\Village\NotificationController::class, 'markRead'])
        ->name('notifications.read');
});


//Villager authenticated routes — login required for engagement

Route::middleware(['auth', 'verified', 'role:villager'])->group(function () {
    Route::post('/news/{id}/like', [PostLikeController::class, 'store'])->name('news.like');
    Route::post('/news/{id}/comment', [CommentController::class, 'store'])->name('news.comment');
    Route::post('/comments/{id}/replies', [CommentController::class, 'reply'])->name('comments.reply');
    Route::get('/profile', fn () => inertia('villager/profile'))->name('villager.profile');

});

//Admin portal — admin and moderator only

Route::get('/admin', fn () => redirect()->route('admin.dashboard'))
    ->middleware(['auth', 'role:admin,moderator']);

Route::prefix('admin')
    ->name('admin.')
    ->middleware(['auth', 'verified', 'role:admin,moderator'])
    ->group(function () {
        Route::inertia('/dashboard', 'admin/dashboard')->name('dashboard');
 
        // Broadcasting — full CRUD + archive/restore
        Route::get('/broadcasting',                      [BroadcastController::class, 'index'])->name('broadcasting.index');
        Route::get('/broadcasting/create',               [BroadcastController::class, 'create'])->name('broadcasting.create');
        Route::post('/broadcasting',                     [BroadcastController::class, 'store'])->name('broadcasting.store');
        Route::get('/broadcasting/archived',             [BroadcastController::class, 'archived'])->name('broadcasting.archived');
        Route::get('/broadcasting/{broadcast}',          [BroadcastController::class, 'show'])->name('broadcasting.show');
        Route::post('/broadcasting/{broadcast}/resend',  [BroadcastController::class, 'resend'])->name('broadcasting.resend');
        Route::post('/broadcasting/archive',             [BroadcastController::class, 'archive'])->name('broadcasting.archive');
        Route::post('/broadcasting/{broadcast}/archive', [BroadcastController::class, 'archiveSingle'])->name('broadcasting.archive-single');
        Route::post('/broadcasting/{broadcast}/restore', [BroadcastController::class, 'restore'])->name('broadcasting.restore');

        // News creator routes
        Route::get('/apakhabar-creator/documents', [NewsCreatorController::class, 'documents'])->name('creator.documents');
        Route::get('/apakhabar-creator/create', [NewsCreatorController::class, 'create'])->name('creator.create');
        Route::get('/apakhabar-creator/archive', [NewsCreatorController::class, 'archive'])->name('creator.archive');
    });

//Post-login redirect — Fortify lands here, bounce by role

Route::get('/dashboard', function () {
    return match(auth()->user()->role) {
        'admin', 'moderator' => redirect()->route('admin.dashboard'),
        default              => redirect()->route('home'),
    };
})->middleware('auth', 'verified')->name('dashboard');

require __DIR__.'/settings.php';