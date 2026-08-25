<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Phone extends Model
{
    protected $primaryKey = 'phone';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'phone',
        'phone_otp',
        'phone_otp_expires_at',
        'phone_verified_at',
        'userID',
    ];

    protected $casts = [
        'phone_otp_expires_at' => 'datetime',
        'phone_verified_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userID', 'userID');
    }
}
