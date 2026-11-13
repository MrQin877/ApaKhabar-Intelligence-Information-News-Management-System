# Mobile news comment investigation

## Findings

The existing comment count is not a backend permission: every active/published news post is eligible, including posts with zero comments. On 2026-11-13, all 18 posts returned HTTP 200 with matching list/detail IDs and consistent numeric counts and comment arrays. Examples: post 17 had 0 comments, post 19 had 1, and post 18 had 11. The homepage and Berita cards navigate using the same API `id`, which Laravel maps from `news.postID`; News Detail is keyed by that ID. No ID remapping change was needed.

Two defects were confirmed:

1. **Backend duplicate detection was shared across readers and reply targets.** The hash contained only news ID and normalized text. A new reader could receive HTTP 422, `errors.content: ["Komentar yang sama sudah dikirim."]`, because another reader had previously submitted that text on the same post. Pending, hidden, and removed comments also participated. Through the running Laravel kernel against MariaDB, identical existing text returned 422 on post 18 and 201 on empty post 17. The same defect rejected a second reader and a reply containing the root comment's text.
2. **Mobile list loading was incorrectly treated as submission permission.** Both `canSend` and `submit` checked the comment-list loading flag. A slow/hung detail refresh disabled sending even though the article itself was already loaded and the session was ready. In addition, `refresh()` reused an in-flight pre-submission GET, so a successful POST could leave an old list/count on screen. Empty-array parsing itself is valid; no condition intentionally forbids the first comment. These state defects reproduce in tests at 0, 1, 2, and 11 existing comments.

The inspected Laravel log tail contained no matching comment-related SQL error. Validation failures return 422 without an application error log. The probe also encountered the existing five-per-minute HTTP 429 limit; that limit is intentional and remains unchanged. Subsequent multi-post probes bypassed throttling only inside their isolated CLI process to avoid confusing rate limits with post eligibility.

## Fixes and changed files

Repo A:

- `app/Services/News/InteractionService.php`: scope duplicate protection to news, authenticated user or stable guest identity, and parent/reply target. Continue recognizing legacy hashes for the original author/target without rewriting any old row. Retain transaction locking and recheck active status under the lock.
- `app/Http/Controllers/News/CommentController.php`: include the authoritative visible `comments_count` in successful root/reply responses. Pending moderation does not increase this count.
- `tests/Feature/News/CommentSubmissionScopeTest.php`: regression coverage for old/new articles, different readers/guests, replies, legacy hashes, duplicate protection, quota accounting, and unavailable moderation.

Repo C:

- `components/news/CommentsSheet.tsx`: allow submission independently of list loading; ignore stale reads after a POST; queue a fresh post-submission read; apply server-confirmed counts immediately; show load errors with the shared `FormError`. Keep drafts after validation/network errors and retain the existing UI and quota dialog.
- `services/newsService.ts`: synchronize returned counts using the article ID for roots and replies.
- `services/newsFeedStore.ts`: update visible feed counts immediately and prevent older in-flight feed reads from undoing them. A later fresh response can still reflect moderator actions.
- `utils/newsComments.ts`: type the optional authoritative count in submission responses.
- `scripts/comment-state-regression.test.cjs`: zero/small/large lists, both session types, slow reads, count ordering, retained drafts, validation errors, and reply-to-news count mapping.

No schema, existing records, authentication rules, guest quotas, rate limits, moderation policy, or comment layout was changed.

## Verification

- **77 Laravel tests passed, 1,216 assertions**, covering the new scope tests plus mobile guests, ordinary engagement, contextual moderation, Shorts, moderation queues, and moderation history.
- Mobile regression scripts passed: `comment-state`, `guest-comments`, `news-comments`, `news-filters`, `news-engagement-focus`, `news-detail`, and `shorts`.
- Final Repo C `tsc --noEmit` reports two ref-type errors in unrelated navigation files, `app/(tabs)/_layout.tsx:32` and `components/navigation/FloatingTabBar.tsx:34`. It reports no errors in the changed comment files. Those navigation files were not modified for this fix.
- Real MariaDB 11.4.13 verification loaded the corrected classes only in a CLI request process. Comments, replies, and guests returned 201 on posts 1, 17, 18, and 19. `newsID`, `parentID`, author links, and returned counts were checked inside the transaction. All test users, tokens, guest quota rows, comments, and history were rolled back. Auto-increment sequences can advance during rolled-back inserts; existing rows were not edited or removed.
- The MariaDB persistence probe used deterministic moderation in its CLI process, not live OpenAI calls. Real moderation behavior remains covered separately by the existing moderation tests; pending review stays hidden and does not increase public counts.

The normal running Docker image was not rebuilt or restarted by these tests. Rebuild/restart the Laravel app using the existing deployment workflow and reload Expo to activate the source changes. No migration is needed.

## Physical-phone checks still required

On Android and iOS/Expo Go, open a 0-comment, 1–2-comment, and many-comment article through both homepage and Berita cards. Check the first comment, replies, keyboard/composer visibility, cold/slow/offline loading, error presentation, navigation to another article and back, and immediate counts. Repeat as guest and authenticated user. Confirm the guest quota dialog after the third accepted submission and that pending moderation remains hidden. These native interactions were not exercised by the Node harness.
