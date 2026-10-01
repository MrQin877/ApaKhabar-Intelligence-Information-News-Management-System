<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->longText('content')->nullable();
        });

        DB::table('intelligent_news_drafts')
            ->orderBy('id')
            ->chunkById(100, function ($drafts) {
                foreach ($drafts as $draft) {
                    $body = json_decode(
                        $draft->body,
                        true,
                        512,
                        JSON_THROW_ON_ERROR,
                    );

                    // Manual drafts already include their opening paragraph in body.
                    $parts = $draft->creation_method === 'manual'
                        ? $body
                        : [$draft->lead, ...$body];

                    $subheadline = trim((string) ($draft->subheadline ?? ''));

                    if ($subheadline !== '') {
                        array_unshift($parts, $subheadline);
                    }

                    DB::table('intelligent_news_drafts')
                        ->where('id', $draft->id)
                        ->update([
                            'content' => collect($parts)
                                ->filter(fn ($part) => trim((string) $part) !== '')
                                ->join("\n\n"),
                        ]);
                }
            });

        $hasSummary = Schema::hasColumn(
            'intelligent_news_drafts',
            'summary',
        );

        $legacyColumns = array_values(array_filter(
            ['subheadline', 'lead', 'body'],
            fn ($column) => Schema::hasColumn(
                'intelligent_news_drafts',
                $column,
            ),
        ));

        Schema::table(
            'intelligent_news_drafts',
            function (Blueprint $table) use ($hasSummary, $legacyColumns) {
                $table->renameColumn('headline', 'title');

                if ($hasSummary) {
                    $table->renameColumn('summary', 'excerpt');
                } else {
                    $table->text('excerpt')->nullable();
                }

                if ($legacyColumns !== []) {
                    $table->dropColumn($legacyColumns);
                }

                $table->longText('content')->nullable(false)->change();
            },
        );

        if (! Schema::hasColumn('news', 'excerpt')) {
            Schema::table('news', function (Blueprint $table) {
                $table->text('excerpt')->nullable();
            });
        }

        // Historical JSON snapshots remain intact.
    }

    public function down(): void
    {
        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->renameColumn('title', 'headline');
            $table->renameColumn('excerpt', 'summary');
            $table->string('subheadline')->nullable();
            $table->longText('lead')->nullable();
            $table->json('body')->nullable();
        });

        DB::table('intelligent_news_drafts')
            ->orderBy('id')
            ->chunkById(100, function ($drafts) {
                foreach ($drafts as $draft) {
                    $parts = preg_split('/\R\s*\R/', $draft->content);
                    $lead = $parts[0];

                    $body = $draft->creation_method === 'manual'
                        ? $parts
                        : (array_slice($parts, 1) ?: ['']);

                    DB::table('intelligent_news_drafts')
                        ->where('id', $draft->id)
                        ->update([
                            'lead' => $lead,
                            'body' => json_encode(
                                $body,
                                JSON_THROW_ON_ERROR,
                            ),
                        ]);
                }
            });

        Schema::table('intelligent_news_drafts', function (Blueprint $table) {
            $table->dropColumn('content');
        });

        // Keep news.excerpt to preserve published content.
    }
};