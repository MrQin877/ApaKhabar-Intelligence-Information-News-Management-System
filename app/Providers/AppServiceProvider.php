<?php

namespace App\Providers;

use App\Notifications\Channels\MongoDBDatabaseChannel;
use App\Models\PersonalAccessToken;  // ← ADD THIS
use Carbon\CarbonImmutable;
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
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);  // ← ADD THIS
        $this->configureDefaults();
        $this->configureNotificationChannels();
    }

    protected function configureNotificationChannels(): void
    {
        Notification::resolved(function ($service) {
            $service->extend('mongodb', function ($app) {
                return new MongoDBDatabaseChannel();
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