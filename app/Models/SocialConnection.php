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
        'insights_synced_at' => 'datetime',
        'invalidated_at' => 'datetime',
    ];

    public function authSource(): string
    {
        return $this->auth_source ?? ($this->platform === 'instagram' ? 'instagram_login' : 'facebook_login');
    }

    public function graphHost(): string
    {
        return $this->authSource() === 'facebook_login' ? 'graph.facebook.com' : 'graph.instagram.com';
    }

    public function isConnected(): bool
    {
        return (bool) $this->access_token && $this->invalidated_at === null && ($this->expires_at === null || $this->expires_at->isFuture());
    }
}
