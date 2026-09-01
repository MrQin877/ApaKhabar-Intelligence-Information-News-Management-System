<?php

namespace App\Models;

use App\Models\Notification as NotificationModel;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Notifications\Notification;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasFactory, Notifiable, TwoFactorAuthenticatable, HasApiTokens;

    protected $primaryKey = 'userID';

    protected $fillable = [
        'name',
        'password',
        'push_token',
        'roleID',
    ];

    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    protected $appends = [
        'id',
        'email',
        'email_verified_at',
        'phone',
        'phone_verified_at',
        'phone_otp',
        'phone_otp_expires_at',
        'role',
    ];

    public function notifications()
    {
        return $this->morphMany(NotificationModel::class, 'notifiable', 'notifiable_type', 'notifiable_id', 'userID')
                    ->orderBy('created_at', 'desc');
    }

    public function emailRecord()
    {
        return $this->hasOne(Email::class, 'userID', 'userID');
    }

    public function phoneRecord()
    {
        return $this->hasOne(Phone::class, 'userID', 'userID');
    }

    public function roleRecord()
    {
        return $this->belongsTo(UserRole::class, 'roleID', 'roleID');
    }

    public function getEmailAttribute(): ?string
    {
        return $this->emailRecord?->getKey();
    }

    public function getIdAttribute(): int
    {
        return (int) $this->getKey();
    }

    public function getEmailVerifiedAtAttribute()
    {
        return $this->emailRecord?->email_verified_at;
    }

    public function getPhoneAttribute(): ?string
    {
        return $this->phoneRecord?->getKey();
    }

    public function getPhoneOtpAttribute()
    {
        return $this->phoneRecord?->phone_otp;
    }

    public function getPhoneOtpExpiresAtAttribute()
    {
        return $this->phoneRecord?->phone_otp_expires_at;
    }

    public function getPhoneVerifiedAtAttribute()
    {
        return $this->phoneRecord?->phone_verified_at;
    }

    public function getRoleAttribute(): ?string
    {
        return $this->roleRecord?->name;
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

    public function sendEmailVerificationNotification(): void
    {
        if (! $this->email) {
            return;
        }

        $this->notify(new VerifyEmail);
    }

    public function getEmailForVerification(): string
    {
        return $this->email;
    }

    public function hasVerifiedEmail(): bool
    {
        if ($this->email && $this->email_verified_at) {
            return true;
        }

        if ($this->phone && $this->phone_verified_at) {
            return true;
        }

        return false;
    }

    public function markEmailAsVerified(): bool
    {
        $email = $this->emailRecord;

        if (! $email || $email->email_verified_at) {
            return false;
        }

        $email->forceFill(['email_verified_at' => now()])->save();

        return true;
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