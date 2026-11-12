# Public news and Shorts engagement counts

Send `Accept: application/json` when consuming these endpoints from the mobile app.

| Endpoint | Items | Count fields |
| --- | --- | --- |
| `GET /api/news` | Response array | `likes_count`, `comments_count` |
| `GET /api/news/{id}` | `data` | `likes_count`, `comments_count` |
| `GET /api/news/{id}/related` | `data[]` | `likes_count`, `comments_count` |
| `GET /api/shorts` | `topShorts[]`, then `shorts.data[]` | `likes_count`, `comments_count` |
| `GET /api/shorts/{id}` | `data` | `likes_count`, `comments_count` |

Both counts are integers, including zero. News retains the legacy `likes` and
`comments` numeric aliases. `comments_list` on news details contains the visible
comment objects. On the Shorts comments endpoint, `count` is the existing total.

The website's Inertia homepage props include the same fields on news items and
`shorts[]`; category and video listings include them as well. A client must render
these fields to show engagement badges; existing card layouts are unchanged.

Likes come from the existing `likes` or `short_video_likes` records, rather than
possibly stale cached counters. Comment totals follow the existing public detail
semantics: news includes published comments and replies whose entire parent chain
is visible; Shorts includes published comments and replies. Pending, hidden,
removed and rejected comments do not contribute. Report flags alone do not hide a
comment while its status remains published. Only active news and published,
nondeleted Shorts with a publication date appear in public listings.

`topShorts` and the paginated `shorts.data` remainder are disjoint. Follow the
pagination links for the remainder; do not add the featured entries to each page
repeatedly. No engagement record or cached counter is rewritten by a GET request.
