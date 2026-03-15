<?php

namespace App\Http\Requests\Settings;

use App\Concerns\ProfileValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ProfileUpdateRequest extends FormRequest
{
    use ProfileValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {

        $userId = (string) $this->user()->getAuthIdentifier();
        $userEmail = $this->user()->email;
        $inputEmail = $this->input('email');
        
        logger("userId: $userId | userEmail: $userEmail | inputEmail: $inputEmail");
        
        return $this->profileRules((string) $this->user()->getAuthIdentifier());
    }
}
