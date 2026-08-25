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
            $email = $credentials['email'];
            unset($credentials['email']);
            $query->whereHas('emailRecord', fn ($query) => $query->where('email', $email));
        }

        foreach ($credentials as $key => $value) {
            if (! is_null($value)) {
                $query->where($key, $value);
            }
        }

        return $query->first();
    }
}
