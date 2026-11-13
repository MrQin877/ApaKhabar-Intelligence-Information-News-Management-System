<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\AuthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProfilePhotoController extends Controller
{
    public function store(Request $request, AuthService $auth)
    {
        $request->validate(['photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120', 'dimensions:max_width=4096,max_height=4096']]);

        // Re-encode to a static JPEG: no SVG, executable payload, EXIF/location, or animation.
        $source = @imagecreatefromstring($request->file('photo')->get());
        if (! $source) {
            throw ValidationException::withMessages(['photo' => 'Imej tidak dapat dibaca. Pilih JPG, PNG atau WebP.']);
        }
        $scale = min(1, 1024 / max(imagesx($source), imagesy($source)));
        $image = imagecreatetruecolor(max(1, (int) (imagesx($source) * $scale)), max(1, (int) (imagesy($source) * $scale)));
        imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
        imagecopyresampled($image, $source, 0, 0, 0, 0, imagesx($image), imagesy($image), imagesx($source), imagesy($source));
        $stream = fopen('php://temp', 'w+');
        imagejpeg($image, $stream, 85);
        rewind($stream);
        $path = 'profile-photos/'.Str::uuid().'.jpg';
        try {
            if (! Storage::disk('public')->put($path, $stream)) {
                abort(503, 'Foto tidak dapat disimpan. Sila cuba lagi.');
            }
            $old = DB::transaction(function () use ($request, $path) {
                $user = User::whereKey($request->user()->getKey())->lockForUpdate()->firstOrFail();
                $old = $user->profile_photo_path;
                $user->forceFill(['profile_photo_path' => $path])->save();

                return $old;
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($path);
            throw $exception;
        } finally {
            fclose($stream);
            imagedestroy($source);
            imagedestroy($image);
        }
        $this->deleteOwnedPhoto($old);

        return response()->json($auth->profile($request->user()->refresh()));
    }

    public function destroy(Request $request, AuthService $auth)
    {
        $old = DB::transaction(function () use ($request) {
            $user = User::whereKey($request->user()->getKey())->lockForUpdate()->firstOrFail();
            $old = $user->profile_photo_path;
            $user->forceFill(['profile_photo_path' => null])->save();

            return $old;
        });
        $this->deleteOwnedPhoto($old);

        return response()->json($auth->profile($request->user()->refresh()));
    }

    private function deleteOwnedPhoto(?string $path): void
    {
        // Never remove unrelated media or user-supplied paths.
        if ($path && preg_match('~^profile-photos/[a-f0-9-]{36}\.jpg$~D', $path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
