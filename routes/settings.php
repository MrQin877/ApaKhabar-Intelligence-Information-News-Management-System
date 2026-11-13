<?php

use App\Http\Controllers\Admin\MetaConnectionController;
use App\Http\Controllers\Auth\ProfilePhotoController;
use App\Http\Controllers\Settings\PhoneVerificationController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');
    Route::post('settings/profile/photo', [ProfilePhotoController::class, 'store'])->middleware('throttle:10,1')->name('profile.photo.store');
    Route::delete('settings/profile/photo', [ProfilePhotoController::class, 'destroy'])->middleware('throttle:10,1')->name('profile.photo.destroy');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('/settings/phone', [PhoneVerificationController::class, 'store'])->name('phone.store');
    Route::post('/settings/phone/verify', [PhoneVerificationController::class, 'verify'])->name('phone.verify');
    Route::post('/settings/phone/resend', [PhoneVerificationController::class, 'resend'])->name('phone.resend');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/security', [SecurityController::class, 'edit'])->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');
});

Route::get('settings/integration', [MetaConnectionController::class, 'integration'])
    ->middleware(['auth', 'verified', 'role:admin,moderator'])->name('integration.edit');
