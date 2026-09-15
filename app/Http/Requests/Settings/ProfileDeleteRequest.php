<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;

class ProfileDeleteRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'password' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    $user = $this->user();

                    if (! $user || ! Hash::check($value, $user->getAuthPassword())) {
                        $fail(__('The password is incorrect.'));
                    }
                },
            ],
        ];
    }
}
