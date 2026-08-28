<?php

namespace App\Providers;

use App\Notifications\Channels\Bulk360Channel;
use App\Models\PersonalAccessToken;  // ← ADD THIS
use App\Auth\NormalizedEloquentUserProvider;
use App\Services\SmsService;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\Sanctum;  // ← ADD THIS

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Auth::provider('normalized-eloquent', function ($app, array $config) {
            return new NormalizedEloquentUserProvider($app['hash'], $config['model']);
        });
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);  // ← ADD THIS
        $this->configureDefaults();
        $this->configureNotificationChannels();
    }

    protected function configureNotificationChannels(): void
    {
        Notification::resolved(function (ChannelManager $service) {
            // ── Bulk360 SMS channel ──
            $service->extend('bulk360', function ($app) {
                return new Bulk360Channel(
                    $app->make(SmsService::class)
                );
            });
        });
    }

    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}