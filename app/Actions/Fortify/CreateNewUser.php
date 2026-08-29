<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Models\Email;
use App\Models\User;
use App\Models\UserRole;
use App\Notifications\OtpNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'nullable', 'required_without:phone', 'string', 'email', 'max:255',
                Rule::unique('emails', 'email'),
            ],
            'phone' => [
                'nullable', 'required_without:email', 'string',
                'regex:/^\+[1-9]\d{1,14}$/',
                Rule::unique('phones', 'phone'),
            ],
            'password' => $this->passwordRules(),
        ], [
            'email.required_without' => 'Sila berikan e-mel atau nombor telefon.',
            'phone.required_without' => 'Sila berikan e-mel atau nombor telefon.',
        ])->validate();

        return DB::transaction(function () use ($input) {
            $user = User::create([
                'name'     => $input['name'],
                'password' => $input['password'],
                'roleID'   => UserRole::firstOrCreate(['name' => 'villager'])->getKey(),
            ]);

            if (! empty($input['email'])) {
                Email::create([
                    'email'  => $input['email'],
                    'userID' => $user->getKey(),
                ]);

                $user->sendEmailVerificationNotification();
            }

            if (! empty($input['phone'])) {
                $otp = rand(100000, 999999);

                $user->phoneRecord()->create([
                    'phone'                => $input['phone'],
                    'phone_otp'            => $otp,
                    'phone_otp_expires_at' => now()->addMinutes(10),
                ]);

                try {
                    $user->notify(new OtpNotification((string) $otp));
                } catch (\Exception $e) {
                    Log::error('OTP failed on registration', ['error' => $e->getMessage()]);
                }
            }

            // Registered with email only → suggest linking a phone next
            if (! empty($input['email']) && empty($input['phone'])) {
                session()->flash('prompt_link_phone', true);
            }

            return $user;
        });
    }
}