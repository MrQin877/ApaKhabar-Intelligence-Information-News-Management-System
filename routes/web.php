<?php

use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

//Public routes — no auth required

Route::get('/', [App\Http\Controllers\WelcomeController::class, 'index'])->name('home');

Route::inertia('/news', 'villager/news/index')->name('news.index');

Route::get('/news/{id}', [App\Http\Controllers\NewsController::class, 'show'])->name('news.show');


//Villager authenticated routes — login required for engagement

Route::middleware(['auth', 'verified', 'role:villager'])->group(function () {
    Route::post('/news/{id}/like', [App\Http\Controllers\PostLikeController::class, 'store'])->name('news.like');
    Route::post('/news/{id}/comment', [App\Http\Controllers\CommentController::class, 'store'])->name('news.comment');
    Route::post('/comments/{id}/replies', [App\Http\Controllers\CommentController::class, 'reply'])->name('comments.reply');
    Route::get('/profile', fn () => inertia('villager/profile'))->name('villager.profile');

    // Notifications
    Route::get('/notifications', [App\Http\Controllers\Villager\NotificationController::class, 'index'])->name('notifications.index');
    Route::patch('/notifications/read-all', [App\Http\Controllers\Villager\NotificationController::class, 'markAllRead'])->name('notifications.read-all');   // 👈 moved up
    Route::patch('/notifications/{notification}/read', [App\Http\Controllers\Villager\NotificationController::class, 'markRead'])->name('notifications.read');
});

//Admin portal — admin and moderator only

Route::get('/admin', fn () => redirect()->route('admin.dashboard'))
    ->middleware(['auth', 'role:admin,moderator']);

Route::prefix('admin')
    ->name('admin.')
    ->middleware(['auth', 'verified', 'role:admin,moderator'])
    ->group(function () {
        Route::inertia('/dashboard', 'admin/dashboard')->name('dashboard');

        // Broadcasting
        Route::inertia('/broadcasting', 'admin/broadcasting/index')->name('broadcasting.index');
        Route::inertia('/broadcasting/create', 'admin/broadcasting/create')->name('broadcasting.create');
        Route::post('/broadcasting', [App\Http\Controllers\Admin\BroadcastController::class, 'store'])->name('broadcasting.store');
        Route::delete('/broadcasting/{broadcast}', [App\Http\Controllers\Admin\BroadcastController::class, 'destroy'])->name('broadcasting.destroy');

        /* Broadcasting
        Route::get('/broadcasting',         [App\Http\Controllers\Admin\BroadcastController::class, 'index'])->name('broadcasting.index');
        Route::get('/broadcasting/create',  [App\Http\Controllers\Admin\BroadcastController::class, 'create'])->name('broadcasting.create');
        Route::post('/broadcasting',        [App\Http\Controllers\Admin\BroadcastController::class, 'store'])->name('broadcasting.store');
        Route::post('/broadcasting/archive',[App\Http\Controllers\Admin\BroadcastController::class, 'archive'])->name('broadcasting.archive');
        Route::post('/broadcasting/{broadcast}/restore', [App\Http\Controllers\Admin\BroadcastController::class, 'restore'])->name('broadcasting.restore');*/
    });

//Post-login redirect — Fortify lands here, bounce by role

Route::get('/dashboard', function () {
    return match(auth()->user()->role) {
        'admin', 'moderator' => redirect()->route('admin.dashboard'),
        default              => redirect()->route('home'),
    };
})->middleware('auth', 'verified')->name('dashboard');

require __DIR__.'/settings.php';