<?php

use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

//Public routes — no auth required

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::inertia('/news', 'villager/news/index')->name('news.index');
Route::inertia('/news/{post}', 'villager/news/show')->name('news.show');


//Villager authenticated routes — login required for engagement


Route::middleware(['auth', 'role:villager'])->group(function () {
    Route::post('/news/{post}/like', [App\Http\Controllers\PostLikeController::class, 'store'])->name('news.like');
    Route::post('/news/{post}/comment', [App\Http\Controllers\CommentController::class, 'store'])->name('news.comment');
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

        // Broadcasting
        Route::inertia('/broadcasting', 'admin/broadcasting/index')->name('broadcasting.index');
        Route::inertia('/broadcasting/create', 'admin/broadcasting/create')->name('broadcasting.create');
        Route::post('/broadcasting', [App\Http\Controllers\Admin\BroadcastController::class, 'store'])->name('broadcasting.store');
        Route::delete('/broadcasting/{broadcast}', [App\Http\Controllers\Admin\BroadcastController::class, 'destroy'])->name('broadcasting.destroy');
    });

//Post-login redirect — Fortify lands here, bounce by role

Route::get('/dashboard', function () {
    return match(auth()->user()->role) {
        'admin', 'moderator' => redirect()->route('admin.dashboard'),
        default              => redirect()->route('home'),
    };
})->middleware('auth')->name('dashboard');

require __DIR__.'/settings.php';