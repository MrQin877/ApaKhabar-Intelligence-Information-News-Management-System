<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Broadcast extends Model
{
    protected $primaryKey = 'alertID';

    protected $fillable = [
        'created_by',
        'title',
        'message',
        'categoryID',
        'status',
        'send_mode',
        'scheduled_at',
        'sent_at',
        'archived_at',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'sent_at'      => 'datetime',
        'archived_at'  => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'userID');
    }

    public function categoryRecord()
    {
        return $this->belongsTo(BroadcastCategory::class, 'categoryID', 'categoryID');
    }

    public function channels()
    {
        return $this->belongsToMany(
            Channel::class,
            'broadcast_channel',
            'broadcast_id',
            'channel_id',
            'alertID',
            'channelID',
        );
    }

    public function users()
    {
        return $this->belongsToMany(
            User::class,
            'broadcast_user',
            'broadcast_id',
            'user_id',
            'alertID',
            'userID',
        );
    }

    public function getCategoryAttribute(): ?string
    {
        return $this->categoryRecord?->name;
    }

    public function getAudienceAttribute(): string
    {
        if ($this->relationLoaded('users')) {
            return $this->users->contains(fn (User $user) => $user->role === 'villager')
                ? 'semua'
                : 'karyawan';
        }

        return 'semua';
    }

    public function scopeCategory(Builder $query, string $category): Builder
    {
        return $query->whereHas('categoryRecord', fn ($query) => $query->where('name', $category));
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