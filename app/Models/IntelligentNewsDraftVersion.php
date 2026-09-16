<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntelligentNewsDraftVersion extends Model
{
    protected $fillable = ['draft_id', 'version', 'change_type', 'snapshot', 'created_by'];

    protected $casts = ['snapshot' => 'array'];

    public function draft()
    {
        return $this->belongsTo(IntelligentNewsDraft::class, 'draft_id');
    }
}
