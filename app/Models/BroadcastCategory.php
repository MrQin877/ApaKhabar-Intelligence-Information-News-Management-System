<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BroadcastCategory extends Model
{
    protected $table = 'broadcast_categories';
    protected $primaryKey = 'categoryID';

    protected $fillable = ['name'];

    public function broadcasts()
    {
        return $this->hasMany(Broadcast::class, 'categoryID', 'categoryID');
    }
}
