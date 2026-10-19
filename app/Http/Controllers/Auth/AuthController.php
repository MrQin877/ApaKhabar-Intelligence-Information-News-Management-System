<?php

/**
 * AuthController.php
 *
 * This controller handles user authentication, including login, registration,
 * logout, profile retrieval, and password reset functionalities.
 *
 * Used for Mobile App API endpoints.
 */

namespace App\Http\Controllers\Auth;

use App\Concerns\DemographicRules;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Services\Auth\AuthService;
use App\Services\Settings\ProfileService;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    use DemographicRules;

    public function __construct(protected AuthService $authService) {}

    public function login(Request $request)
    {
        $request->validate([
            'email' => ['nullable', 'email', 'required_without:phone'],
            'phone' => ['nullable', 'string', 'required_without:email', 'regex:/^\+[1-9]\d{1,14}$/'],
            'password' => ['required', 'string'],
        ]);

        $result = $this->authService->login(
            $request->input('email'),
            $request->input('phone'),
            $request->password,
        );

        if (! $result) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        return response()->json($result);
    }

    public function register(Request $request)
    {
        $request->validate([
            ...$this->demographicRules(true),
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'required_without:phone', 'email', 'max:255', 'unique:emails,email'],
            'phone' => ['nullable', 'required_without:email', 'string', 'regex:/^\+[1-9]\d{1,14}$/', 'unique:phones,phone'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $result = $this->authService->register(
            $request->name,
            $request->input('email'),
            $request->input('phone'),
            $request->password,
            $request->only(['date_of_birth', 'citizenship', 'gender', 'ethnicity']),
        );

        return response()->json($result, 201);
    }

    public function logout(Request $request)
    {
        $this->authService->logout($request->user(), $request->bearerToken());

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function profile(Request $request)
    {
        return response()->json($this->authService->profile($request->user()));
    }

    public function updateProfile(ProfileUpdateRequest $request, ProfileService $profiles)
    {
        $profiles->updateProfile($request->user(), $request->validated());

        return response()->json($this->authService->profile($request->user()->refresh()));
    }

    public function savePushToken(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        $this->authService->savePushToken($request->user(), $request->token);

        return response()->json(['message' => 'Push token saved']);
    }

    public function removePushToken(Request $request)
    {
        $this->authService->removePushToken($request->user());

        return response()->json(['message' => 'Push token removed']);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $sent = $this->authService->forgotPassword($request->email);

        if ($sent) {
            return response()->json(['message' => 'Reset link sent to your email.']);
        }

        return response()->json(['message' => 'Email not found.'], 404);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|min:8|confirmed',
        ]);

        $success = $this->authService->resetPassword(
            $request->token,
            $request->email,
            $request->password
        );

        if ($success) {
            return response()->json(['message' => 'Password reset successfully.']);
        }

        return response()->json(['message' => 'Invalid or expired token.'], 422);
    }
}
