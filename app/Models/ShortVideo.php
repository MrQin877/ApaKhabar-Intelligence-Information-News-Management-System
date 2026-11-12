<?php

namespace App\Models;

use App\Support\NewsImageUrl;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ShortVideo extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected $casts = ['metadata' => 'array', 'published_at' => 'datetime', 'frame_offset' => 'float', 'view_count' => 'integer', 'likes_count' => 'integer', 'comments_count' => 'integer'];

    public function likes()
    {
        return $this->belongsToMany(User::class, 'short_video_likes', 'short_video_id', 'user_id');
    }

    public function scopeWithPublicEngagement($query)
    {
        return $query->withCount(['likes', 'comments' => fn ($comments) => $comments->where('status', 'published')]);
    }

    public function getThumbnailUrlAttribute(?string $value): ?string
    {
        return NewsImageUrl::resolve($value);
    }

    public function getVideoUrlAttribute(?string $value): ?string
    {
        return NewsImageUrl::resolve($value);
    }

    public function toArray(): array
    {
        $data = parent::toArray();
        if (is_array($data['metadata'] ?? null)) {
            array_walk_recursive($data['metadata'], function (&$value) {
                if (is_string($value)) {
                    $value = NewsImageUrl::resolve($value);
                }
            });
        }

        return $data;
    }

    public function comments()
    {
        return $this->hasMany(ShortVideoComment::class);
    }

    public function publications()
    {
        return $this->hasMany(ShortVideoPublication::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'userID');
    }
}
