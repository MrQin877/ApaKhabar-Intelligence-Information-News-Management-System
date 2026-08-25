<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Channel extends Model
{
    protected $primaryKey = 'channelID';

    protected $fillable = ['name'];

    public function broadcasts()
    {
        return $this->belongsToMany(
            Broadcast::class,
            'broadcast_channel',
            'channel_id',
            'broadcast_id',
            'channelID',
            'alertID',
        );
    }
}
