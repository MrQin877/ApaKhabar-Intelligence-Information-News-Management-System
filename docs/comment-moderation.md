# Comment moderation

News comments, news replies, video comments, and video replies use the same `CommentModeration` service before insertion. No keyword lists or RAG are used.

1. Call `omni-moderation-latest`. Its `flagged` decision or any true category holds the comment for review.
2. If cleared, call an OpenAI contextual classifier with strict JSON output to enforce ApaKhabar's profanity, harassment, threat, hate, and other harmful content rules. It understands English, Indonesian, Malay, mixed language, and slang. The policy distinguishes abuse from criticism, literal meanings, and neutral quotations; quoted abuse used as an attack remains inappropriate.
3. Publish only when both checks succeed and clear the comment. Missing credentials, HTTP errors (including 429), connection errors, refusals, truncated output, malformed JSON, or invalid classifications leave it `pending_review`, with `ai_flagged = null` and `moderation_unavailable`.

Confirmed violations remain saved as `pending_review`, with `ai_flagged = true` and category booleans. They appear in Admin → Komentar Moderasi with source **Ditandai AI**. The detail dialog shows localized category reasons. Unavailable assessments appear in the general pending queue because they are not confirmed AI violations.

The existing submission transaction writes one initial history entry and prevents duplicate submissions. AI results do not create manual admin flags or user reports. Izinkan / Sembunyikan keep their existing behavior and preserve the initial AI categories and history. This change requires no migration, backfill, or changes to existing comments.

## Configuration and operations

Set `OPENAI_API_KEY` in the Laravel application's environment (`deployment/laravel.env` for the Docker deployment). The deployment Compose interpolation file `deployment/.env` is separate from the Laravel runtime environment. Contextual classification defaults to `gpt-4.1-mini`; override with `OPENAI_COMMENT_CLASSIFICATION_MODEL` using a model that supports Chat Completions and strict JSON schema. The contextual call uses the same key and requires access and quota for that model; it adds a paid request for each comment cleared by moderation. Timeouts are configured in `config/engagement.php` (8 seconds for moderation, 15 for classification, each with a 3-second connection timeout). Reload cached Laravel configuration and restart persistent workers after changing environment configuration.

Scores are logged as `Comment moderation assessment` without comment text or credentials. Failures log only exception class and HTTP status. The application keeps OpenAI's category decisions and does not impose arbitrary score cutoffs. OpenAI does not return the underlying thresholds, and warns that custom score policies need recalibration as models change: [official moderation documentation](https://developers.openai.com/api/docs/guides/moderation).

## Validation

Run isolated SQLite tests:

```powershell
php vendor/bin/pest tests/Feature/News/ContextualCommentModerationTest.php tests/Feature/News/EngagementTest.php tests/Feature/News/ShortEngagementTest.php tests/Feature/News/ModerationQueueTest.php tests/Feature/News/ModerationFeedbackTest.php tests/Feature/News/MobileGuestCommentsTest.php
```

The fixture contract tests simulate classifier decisions; they verify integration, not language-model accuracy. To measure real model behavior using synthetic comments only, without accessing application records:

```powershell
php scripts/probe-comment-moderation.php --env-file=deployment/laravel.env
php scripts/probe-comment-moderation.php --env-file=deployment/laravel.env --moderation-only
```

The full probe prints raw moderation categories/scores, final decisions, expected categories, and pass/fail for hiding versus publishing. Category names can differ between the two models; inspect the actual reasons as well as the verdict. A failure stops the full probe; the moderation-only probe diagnoses the original endpoint separately.

Live observation on 2026-11-13: all 16 synthetic inputs reached the Moderation API. Ordinary comments, criticism, neutral quotation, and a literal Indonesian animal reference were cleared. Four standalone profanity samples were also cleared:

| Input | Flagged | Harassment score |
| --- | --- | --- |
| fuck | false | 0.056478 |
| bangsat | false | 0.004971 |
| sialan | false | 0.000067 |
| pukimak | false | 0.005213 |

The insult, threat, hate, and abusive prompt-injection samples were flagged. The English threat had a violence score of 0.942834; the Indonesian/Malay threat had 0.952451. This confirms that lowering a harassment threshold is not a reliable profanity policy.

Live contextual evaluation was blocked by HTTP 429 for the configured key. The first normal sample correctly remained pending rather than being published. Resolve the account's model quota/rate limit and rerun the full probe before claiming live contextual accuracy. No automatic retry or automatic republication occurs after an unavailable assessment; pending comments remain available for admin review.
