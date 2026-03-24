<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Broadcast extends Model
{
    protected $fillable = [
        'created_by',
        'title',
        'message',
        'category',
        'channels',
        'audience',
        'status',
        'send_mode',
        'scheduled_at',
        'sent_at',
        'archived_at',
    ];

    protected $casts = [
        'channels'     => 'array',   // auto encode/decode JSON
        'scheduled_at' => 'datetime',
        'sent_at'      => 'datetime',
        'archived_at'  => 'datetime',
    ];

    // ── Relationships ──────────────────────────────────
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ── Scopes ─────────────────────────────────────────
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function scopeArchived(Builder $query): Builder
    {
        return $query->whereNotNull('archived_at');
    }

    public function scopeForAudience(Builder $query, string $role): Builder
    {
        return $query->where(function ($q) use ($role) {
            $q->where('audience', 'semua')
              ->orWhere('audience', $role);
        });
    }

    // ── Helpers ────────────────────────────────────────
    public function isArchived(): bool
    {
        return !is_null($this->archived_at);
    }
}
