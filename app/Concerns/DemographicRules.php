<?php

namespace App\Concerns;

use Illuminate\Validation\Rule;

trait DemographicRules
{
    protected function demographicRules(bool $registration = false): array
    {
        return [
            'date_of_birth' => [$registration ? 'required' : 'sometimes', 'required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:'.now()->subYears(120)->format('Y-m-d')],
            'citizenship' => [$registration ? 'required' : 'sometimes', 'required', Rule::in(['wni', 'wna', 'dual'])],
            'gender' => ['sometimes', 'nullable', Rule::in(['male', 'female', 'undisclosed'])],
            'ethnicity' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }
}
