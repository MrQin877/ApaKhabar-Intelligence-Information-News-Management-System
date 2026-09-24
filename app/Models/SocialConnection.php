<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SocialConnection extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['access_token'];

    protected $casts = [
        'access_token' => 'encrypted',
        'expires_at' => 'datetime',
        'invalidated_at' => 'datetime',
    ];

    public function isConnected(): bool
    {
        return $this->invalidated_at === null && ($this->expires_at === null || $this->expires_at->isFuture());
    }
}
