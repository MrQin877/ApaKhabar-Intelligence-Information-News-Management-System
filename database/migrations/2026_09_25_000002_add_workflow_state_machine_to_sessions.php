<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    // Session business state already has its columns. Agent execution state is
    // checkpointed by the AI service; this previously empty migration is a no-op.
    public function up(): void {}

    public function down(): void {}
};
