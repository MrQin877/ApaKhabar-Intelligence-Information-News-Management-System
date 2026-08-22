<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

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
        'channels'     => 'array', // JSON column decodes/encodes automatically
        'scheduled_at' => 'datetime',
        'sent_at'      => 'datetime',
        'archived_at'  => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function scopeArchived(Builder $query): Builder
    {
        return $query->whereNotNull('archived_at');
    }

    public function isArchived(): bool
    {
        return !is_null($this->archived_at);
    }
}