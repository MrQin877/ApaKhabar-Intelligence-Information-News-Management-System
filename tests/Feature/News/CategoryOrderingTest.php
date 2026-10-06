<?php

use App\Models\NewsCategory;
use App\Models\User;
use App\Models\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

function categoryManager(string $role): User
{
    return User::factory()->create(['roleID' => UserRole::firstOrCreate(['name' => $role])->getKey()]);
}

beforeEach(function () {
    $this->first = NewsCategory::create(['name' => 'Pendidikan', 'slug' => 'pendidikan-sort', 'display_order' => 1, 'status' => 'active']);
    $this->hidden = NewsCategory::create(['name' => 'Hidden', 'slug' => 'hidden-sort', 'display_order' => 2, 'status' => 'inactive']);
    $this->last = NewsCategory::create(['name' => 'Lingkungan', 'slug' => 'lingkungan-sort', 'display_order' => 3, 'status' => 'active']);
    $this->ids = NewsCategory::orderBy('display_order')->orderBy('name')->pluck('categoryID')->all();
});

test('category managers can save navigation order without modifying category content', function (string $role) {
    $this->actingAs(categoryManager($role));
    $this->get('/admin/categories')->assertOk();
    $ids = array_reverse($this->ids);
    $this->postJson('/admin/categories/reorder', ['ids' => $ids, 'original_ids' => $this->ids])->assertOk();
    expect(NewsCategory::orderBy('display_order')->pluck('categoryID')->all())->toBe($ids);
    foreach ($ids as $index => $id) {
        expect(NewsCategory::findOrFail($id)->display_order)->toBe($index + 1);
    }
    expect($this->hidden->fresh()->is_active)->toBeFalse();
    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('categories', ['Lingkungan', 'Pendidikan']));
    $this->getJson('/api/categories')->assertJsonPath('categories.0.id', $this->last->getKey())
        ->assertJsonMissing(['id' => $this->hidden->getKey()]);
})->with(['admin', 'moderator']);

test('category ordering rejects malformed or incomplete lists without writing changes', function (string $kind) {
    $this->actingAs(categoryManager('admin'));
    $ids = match ($kind) {
        'duplicate' => [$this->first->getKey(), $this->first->getKey(), $this->last->getKey()],
        'missing' => [$this->first->getKey()],
        'unknown' => [$this->first->getKey(), $this->hidden->getKey(), 999999],
        'empty' => [],
    };
    $this->postJson('/admin/categories/reorder', ['ids' => $ids, 'original_ids' => $this->ids])->assertUnprocessable();
    expect(NewsCategory::orderBy('display_order')->pluck('categoryID')->all())->toBe($this->ids);
})->with(['duplicate', 'missing', 'unknown', 'empty']);

test('category ordering rejects a stale arrangement after another manager saves', function () {
    $this->actingAs(categoryManager('admin'));
    $ids = array_reverse($this->ids);
    $this->postJson('/admin/categories/reorder', ['ids' => $ids, 'original_ids' => $this->ids])->assertOk();
    $this->postJson('/admin/categories/reorder', ['ids' => $this->ids, 'original_ids' => $this->ids])
        ->assertUnprocessable()->assertJsonValidationErrors('ids');
    expect(NewsCategory::orderBy('display_order')->pluck('categoryID')->all())->toBe($ids);
});

test('villagers cannot manage categories or reorder public navigation', function () {
    $this->actingAs(categoryManager('villager'));
    $this->get('/admin/categories')->assertRedirect(route('home'));
    $this->postJson('/admin/categories/reorder', ['ids' => array_reverse($this->ids), 'original_ids' => $this->ids])->assertRedirect(route('home'));
    $this->postJson('/admin/categories', ['name' => 'Unauthorized'])->assertRedirect(route('home'));
    expect(NewsCategory::orderBy('display_order')->pluck('categoryID')->all())->toBe($this->ids);
    expect(NewsCategory::where('name', 'Unauthorized')->exists())->toBeFalse();
});

test('moderators can create and edit categories through the shared controller', function () {
    $this->actingAs(categoryManager('moderator'));
    $id = $this->postJson('/admin/categories', ['name' => 'Moderator category', 'status' => 'active'])->assertCreated()->json('category.categoryID');
    $this->putJson('/admin/categories/'.$id, ['name' => 'Renamed category', 'status' => 'inactive'])->assertOk();
    expect(NewsCategory::findOrFail($id)->name)->toBe('Renamed category');
});
