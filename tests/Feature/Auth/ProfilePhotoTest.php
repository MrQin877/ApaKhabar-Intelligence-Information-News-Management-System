<?php

use App\Models\Comment;
use App\Models\News;
use App\Models\ShortVideo;
use App\Models\ShortVideoComment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->photoUser = User::factory()->create();
    $this->withToken($this->photoUser->createToken('photo-test')->plainTextToken);
});

test('photo uploads require authentication and cannot target another user', function () {
    $other = User::factory()->create();
    $this->postJson('/api/profile/photo', ['user_id' => $other->id, 'photo' => UploadedFile::fake()->image('photo.png', 80, 80)])
        ->assertOk()->assertJsonPath('id', (string) $this->photoUser->id)->assertJsonMissingPath('profile_photo_path');
    expect($other->fresh()->profile_photo_path)->toBeNull();
    $this->withHeaders(['Authorization' => ''])->postJson('/api/profile/photo')->assertUnauthorized();
    $this->deleteJson('/api/profile/photo')->assertUnauthorized();
});

test('uploads are reencoded and old photos are replaced and removed without changing account data', function () {
    $original = $this->photoUser->only(['name', 'password', 'roleID']);
    $first = $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('photo.png', 1200, 800)])
        ->assertOk()->json('avatar');
    $old = $this->photoUser->fresh()->profile_photo_path;
    Storage::disk('public')->assertExists($old);
    $info = getimagesizefromstring(Storage::disk('public')->get($old));
    expect($info[0])->toBe(1024)->and($info['mime'])->toBe('image/jpeg');
    $second = $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('next.jpg')])->assertOk()->json('avatar');
    expect($second)->not->toBe($first);
    Storage::disk('public')->assertMissing($old);
    $current = $this->photoUser->fresh()->profile_photo_path;
    $this->getJson('/api/profile')->assertOk()->assertJsonPath('avatar', $second)->assertJsonPath('profile_photo_url', $second);
    $this->deleteJson('/api/profile/photo')->assertOk()->assertJsonPath('avatar', null);
    Storage::disk('public')->assertMissing($current);
    expect($this->photoUser->fresh()->only(array_keys($original)))->toBe($original);
    $this->deleteJson('/api/profile/photo')->assertOk();
});

test('invalid types oversized files and excessive dimensions leave the current photo intact', function () {
    $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('valid.jpg')])->assertOk();
    $old = $this->photoUser->fresh()->profile_photo_path;
    foreach ([
        UploadedFile::fake()->create('unsafe.svg', 1, 'image/svg+xml'),
        UploadedFile::fake()->image('large.jpg')->size(5121),
        UploadedFile::fake()->image('wide.png', 4097, 1),
        UploadedFile::fake()->createWithContent('fake.jpg', '<?php echo "unsafe";'),
    ] as $file) {
        $this->postJson('/api/profile/photo', ['photo' => $file])->assertUnprocessable()->assertJsonValidationErrors('photo');
    }
    expect($this->photoUser->fresh()->profile_photo_path)->toBe($old);
    Storage::disk('public')->assertExists($old);
});

test('existing published comments and replies on news and shorts use the current photo', function () {
    $user = $this->photoUser;
    $news = News::factory()->create();
    $root = Comment::create(['newsID' => $news->getKey(), 'userID' => $user->getKey(), 'content' => 'Existing', 'status' => 'published']);
    Comment::create(['newsID' => $news->getKey(), 'userID' => $user->getKey(), 'parentID' => $root->getKey(), 'content' => 'Reply', 'status' => 'published']);
    $video = ShortVideo::create(['created_by' => $user->id, 'title' => 'Short', 'video_url' => 'https://example.test/video.mp4', 'video_public_id' => 'photo-test', 'thumbnail_url' => 'https://example.test/cover.jpg', 'metadata' => [], 'status' => 'published', 'published_at' => now()]);
    $shortRoot = ShortVideoComment::create(['short_video_id' => $video->id, 'user_id' => $user->id, 'content' => 'Existing', 'status' => 'published', 'submission_hash' => hash('sha256', 'photo-root')]);
    ShortVideoComment::create(['short_video_id' => $video->id, 'user_id' => $user->id, 'root_id' => $shortRoot->id, 'parent_id' => $shortRoot->id, 'content' => 'Reply', 'status' => 'published', 'submission_hash' => hash('sha256', 'photo-reply')]);
    $avatar = $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('avatar.jpg')])->assertOk()->json('avatar');
    $this->getJson('/api/news/'.$news->getKey())->assertOk()->assertJsonPath('data.comments_list.0.avatar', $avatar)->assertJsonPath('data.comments_list.1.avatar', $avatar);
    $this->getJson('/api/shorts/'.$video->id.'/comments')->assertOk()->assertJsonFragment(['avatar' => $avatar]);
    $this->getJson('/api/shorts/'.$video->id.'/comments/'.$shortRoot->id.'/replies')->assertOk()->assertJsonFragment(['avatar' => $avatar]);
    $this->deleteJson('/api/profile/photo')->assertOk();
    $this->getJson('/api/news/'.$news->getKey())->assertOk()->assertJsonPath('data.comments_list.0.avatar', null)->assertJsonPath('data.comments_list.1.avatar', null);
    expect(Comment::count())->toBe(2)->and(ShortVideoComment::count())->toBe(2);
});
