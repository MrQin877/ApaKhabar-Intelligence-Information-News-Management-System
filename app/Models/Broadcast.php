<?php

namespace App\Models;
//use Illuminate\Database\Eloquent\Model; for Eloquent, Relational DB
use MongoDB\Laravel\Eloquent\Model;      // Illuminate to MongoDB
use Illuminate\Database\Eloquent\Builder;

class Broadcast extends Model
{
    protected $connection = 'mongodb';   // ← add
    protected $collection = 'broadcasts'; // ← add

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
        'scheduled_at' => 'datetime',
        'sent_at'      => 'datetime',
        'archived_at'  => 'datetime',
    ];

    //remove if use SQL, MongoDB sudah otomatis mengembalikan array untuk field JSON
    public function getChannelsAttribute($value): array
    {
        if (is_array($value)) {
            return $value; // MongoDB — already an array
        }
        return json_decode($value, true) ?? []; // SQL — decode JSON string
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', '_id');
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