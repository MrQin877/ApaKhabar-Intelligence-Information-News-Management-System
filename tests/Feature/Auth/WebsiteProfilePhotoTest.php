<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('website session photo changes share the mobile profile and preserve other accounts', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $other = User::factory()->create();
    $this->postJson('/settings/profile/photo')->assertUnauthorized();
    $avatar = $this->actingAs($user)->postJson('/settings/profile/photo', [
        'user_id' => $other->id, 'photo' => UploadedFile::fake()->image('crop.jpg', 512, 512),
    ])->assertOk()->json('avatar');
    expect($other->fresh()->profile_photo_path)->toBeNull();
    $path = $user->fresh()->profile_photo_path;
    Storage::disk('public')->assertExists($path);
    $this->withToken($user->createToken('shared')->plainTextToken)->getJson('/api/profile')->assertOk()->assertJsonPath('avatar', $avatar);
    $this->postJson('/settings/profile/photo', ['photo' => UploadedFile::fake()->createWithContent('broken.png', 'not an image')])->assertUnprocessable();
    expect($user->fresh()->profile_photo_path)->toBe($path);
    $this->deleteJson('/settings/profile/photo')->assertOk()->assertJsonPath('avatar', null);
    Storage::disk('public')->assertMissing($path);
    $this->getJson('/api/profile')->assertOk()->assertJsonPath('avatar', null);
});
