<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\NewsController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\PostLikeController;
use App\Http\Controllers\Api\BroadcastController;  // ← ADD THIS
use App\Http\Middleware\ApiAuth;

// Public routes
Route::post('/login',    [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::get('/news',      [NewsController::class, 'index']);
Route::get('/news/{id}', [NewsController::class, 'show']);
Route::get('/news/{id}/related', [NewsController::class, 'related']);
Route::get('/broadcasts/darurat', [BroadcastController::class, 'darurat']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password',  [AuthController::class, 'resetPassword']);

// Protected routes — use our custom middleware
Route::middleware(ApiAuth::class)->group(function () {
    Route::post('/logout',                       [AuthController::class, 'logout']);
    Route::get('/profile',                       [AuthController::class, 'profile']);
    Route::get('/notifications',                 [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all',      [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{id}/read',     [NotificationController::class, 'markRead']);
    Route::post('/news/{id}/like',               [PostLikeController::class, 'store']);
    Route::post('/news/{id}/comment',            [CommentController::class, 'store']);
    Route::post('/comments/{id}/replies',        [CommentController::class, 'reply']);
});