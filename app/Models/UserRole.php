<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserRole extends Model
{
    protected $table = 'user_roles';
    protected $primaryKey = 'roleID';

    protected $fillable = ['name'];

    public function users()
    {
        return $this->hasMany(User::class, 'roleID', 'roleID');
    }
}
