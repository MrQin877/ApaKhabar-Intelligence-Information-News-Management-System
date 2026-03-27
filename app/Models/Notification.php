<?php

namespace App\Models;

//use Illuminate\Database\Eloquent\Model;
use MongoDB\Laravel\Eloquent\Model;

class Notification extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'notifications';

    protected $fillable = [
        'type',
        'notifiable_id',
        'notifiable_type',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data'    => 'array',
        'read_at' => 'datetime',
    ];

    public function markAsRead(): void
    {
        $this->update(['read_at' => now()]);
    }

    public function isUnread(): bool
    {
        return is_null($this->read_at);
    }
}