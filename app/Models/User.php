<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
// use Illuminate\Foundation\Auth\User as Authenticatable;
use MongoDB\Laravel\Auth\User as Authenticatable; // Use the MongoDB User model instead of the default Eloquent User model
use Illuminate\Notifications\Notifiable;
use Illuminate\Auth\Notifications\VerifyEmail;
use App\Models\Notification as MongoNotification;
use Illuminate\Notifications\Notification;
use Laravel\Fortify\TwoFactorAuthenticatable;



class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    protected $connection = 'mongodb'; // Specify the MongoDB connection for this model

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'phone',              // ← add
        'phone_verified_at',  // ← add
        'phone_otp',          // ← add (temporary OTP storage)
        'phone_otp_expires_at', // ← add
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];
    // Remove if using SQL
    public function notifications()
    {
        return $this->morphMany(MongoNotification::class, 'notifiable')
                    ->orderBy('created_at', 'desc');
    }
    
    // Remove if using SQL
    public function unreadNotifications()
    {
        return $this->notifications()->whereNull('read_at');
    }

    // Remove if using SQL
    public function readNotifications()
    {
        return $this->notifications()->whereNotNull('read_at');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at'    => 'datetime',
            'phone_verified_at'    => 'datetime',  // ← add
            'phone_otp_expires_at' => 'datetime',  // ← add
            'password'             => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

     public function getKey()
    {
        return (string) $this->_id;
    }

    // Explicitly send verification notification
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmail);
    }

    // Fix signed URL generation for MongoDB ObjectId
    public function getEmailForVerification(): string
    {
        return $this->email;
    }

    public function routeNotificationForVonage(Notification $notification): string
    {
        return $this->phone ?? '';
    }

    // Helper methods (very handy in blade/inertia)
    public function isAdmin(): bool { return $this->role === 'admin'; }
    public function isModerator(): bool { return $this->role === 'moderator'; }
    public function isVillager(): bool { return $this->role === 'villager'; }
    public function hasVerifiedPhone(): bool { return !is_null($this->phone_verified_at); }
}