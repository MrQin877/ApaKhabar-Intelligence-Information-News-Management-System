<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class PostLikeController extends Controller
{
    public function store(Request $request, $id)
    {
        // TODO: implement like logic
        return response()->json(['message' => 'Liked.']);
    }
}