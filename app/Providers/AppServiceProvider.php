<?php

namespace App\Providers;

use App\Notifications\Channels\Bulk360Channel;
use App\Notifications\Channels\MongoDBDatabaseChannel;
use App\Services\SmsService;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureNotificationChannels();
    }

    // ── Register custom notification channels ──────────
    protected function configureNotificationChannels(): void
    {
        Notification::resolved(function (ChannelManager $service) {
            // ── MongoDB in-app channel ──
            $service->extend('mongodb', function ($app) {
                return new MongoDBDatabaseChannel();
            });

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