<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Home\EmergencyBroadcastController;
use App\Http\Controllers\News\CommentController;
use App\Http\Controllers\News\NewsController;
use App\Http\Controllers\News\PostLikeController;
use App\Http\Controllers\Village\NotificationController;
use App\Http\Middleware\ApiAuth;
use App\Http\Controllers\Auth\MobileEmailVerificationController;

use App\Http\Controllers\Auth\MobilePhoneVerificationController;

// Public phone recovery is purpose-scoped and shared by browser and mobile clients.
Route::prefix('phone/password')->middleware('throttle:30,1')->group(function () {
    Route::get('/status', [\App\Http\Controllers\Auth\PhonePasswordResetController::class, 'status']);
    Route::post('/send', [\App\Http\Controllers\Auth\PhonePasswordResetController::class, 'send']);
    Route::post('/verify', [\App\Http\Controllers\Auth\PhonePasswordResetController::class, 'verify']);
    Route::post('/reset', [\App\Http\Controllers\Auth\PhonePasswordResetController::class, 'reset']);
});

// Public routes
Route::post('/login',    [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::get('/news',      [NewsController::class, 'index']);
Route::get('/news/{id}', [NewsController::class, 'show']);
Route::get('/news/{id}/related', [NewsController::class, 'related']);
Route::get('/broadcasts/darurat', [EmergencyBroadcastController::class, 'darurat']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password',  [AuthController::class, 'resetPassword']);

// Protected routes — use our custom middleware
Route::middleware(ApiAuth::class)->group(function () {
    Route::get('/phone/change-verification', [\App\Http\Controllers\Auth\MobilePhoneChangeController::class, 'status']);
    Route::post('/phone/change-verification', [\App\Http\Controllers\Auth\MobilePhoneChangeController::class, 'send']);
    Route::post('/phone/change-verification/verify', [\App\Http\Controllers\Auth\MobilePhoneChangeController::class, 'verify'])->middleware('throttle:10,1');

    Route::get('/phone/verification-status', [MobilePhoneVerificationController::class, 'status']);
    Route::post('/phone/verification-notification', [MobilePhoneVerificationController::class, 'send']);
    Route::post('/phone/verify', [MobilePhoneVerificationController::class, 'verify'])->middleware('throttle:10,1');
    Route::post('/logout',                       [AuthController::class, 'logout']);
    Route::get('/profile',                       [AuthController::class, 'profile']);
    Route::patch('/profile', [AuthController::class, 'updateProfile']);
    Route::post('/email/verification-notification', [MobileEmailVerificationController::class, 'send'])
        ->middleware('throttle:1,1')->name('api.verification.send');
    Route::get('/notifications',                 [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all',      [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{id}/read',     [NotificationController::class, 'markRead']);
    Route::post('/news/{id}/like',               [PostLikeController::class, 'store']);
    Route::post('/news/{id}/comment',            [CommentController::class, 'store']);
    Route::post('/comments/{id}/replies',        [CommentController::class, 'reply']);
    Route::post('/push-token',   [AuthController::class, 'savePushToken']);    // ← save on login
    Route::delete('/push-token', [AuthController::class, 'removePushToken']); // ← remove on logout
});
