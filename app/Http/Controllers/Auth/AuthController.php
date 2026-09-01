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

use App\Http\Controllers\Controller;
use App\Services\Auth\AuthService;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(protected AuthService $authService)
    {
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $result = $this->authService->login($request->email, $request->password);

        if (! $result) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        return response()->json($result);
    }

    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:emails,email',
            'password' => 'required|min:8',
        ]);

        $result = $this->authService->register(
            $request->name,
            $request->email,
            $request->password
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