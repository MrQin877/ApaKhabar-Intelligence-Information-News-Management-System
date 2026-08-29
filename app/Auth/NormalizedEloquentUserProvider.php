<?php

namespace App\Auth;

use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Arr;

class NormalizedEloquentUserProvider extends EloquentUserProvider
{
    public function retrieveByCredentials(array $credentials): ?Authenticatable
    {
        $credentials = Arr::except($credentials, ['password', 'password_confirmation']);
        $query = $this->newModelQuery();

        if (isset($credentials['email'])) {
            $login = $credentials['email'];
            unset($credentials['email']);

            if (filter_var($login, FILTER_VALIDATE_EMAIL)) {
                $query->whereHas('emailRecord', fn ($q) => $q->where('email', $login));
            } else {
                $query->whereHas('phoneRecord', fn ($q) => $q->where('phone', $login));
            }
        }

        foreach ($credentials as $key => $value) {
            if (! is_null($value)) {
                $query->where($key, $value);
            }
        }

        return $query->first();
    }
}