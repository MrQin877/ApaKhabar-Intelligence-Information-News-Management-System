<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use MongoDB\Laravel\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Auth\Notifications\VerifyEmail;
use App\Models\Notification as MongoNotification;
use Illuminate\Notifications\Notification;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;  // ← ADDED BACK

class User extends Authenticatable implements MustVerifyEmail
{
    use HasFactory, Notifiable, TwoFactorAuthenticatable, HasApiTokens;  // ← ADDED BACK

    protected $connection = 'mongodb';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'phone',
        'phone_verified_at',
        'phone_otp',
        'phone_otp_expires_at',
    ];

    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    public function notifications()
    {
        return $this->morphMany(MongoNotification::class, 'notifiable')
                    ->orderBy('created_at', 'desc');
    }

    public function unreadNotifications()
    {
        return $this->notifications()->whereNull('read_at');
    }

    public function readNotifications()
    {
        return $this->notifications()->whereNotNull('read_at');
    }

    protected function casts(): array
    {
        return [
            'email_verified_at'       => 'datetime',
            'phone_verified_at'       => 'datetime',
            'phone_otp_expires_at'    => 'datetime',
            'password'                => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function getKey()
    {
        return (string) $this->_id;
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmail);
    }

    public function getEmailForVerification(): string
    {
        return $this->email;
    }

    public function routeNotificationForVonage(Notification $notification): string
    {
        return $this->phone ?? '';
    }

    public function isAdmin(): bool { return $this->role === 'admin'; }
    public function isModerator(): bool { return $this->role === 'moderator'; }
    public function isVillager(): bool { return $this->role === 'villager'; }
    public function hasVerifiedPhone(): bool { return !is_null($this->phone_verified_at); }
}