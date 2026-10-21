---
title: Podcast Search API
description: Search podcast metadata or transcript meaning with the Freespoke Partner API
sidebar:
    order: 2
---

# Podcast Search API

The Podcast Search API searches Freespoke's library of transcribed podcast
episodes by metadata or transcript words (**Keyword**) or transcript meaning (**Semantic**). Store
opaque references to fetch episode metadata or matched moments later. It is part
of the [Freespoke Partner API](/developers/partner-api) and uses the same base URL
and authentication.

If you would like access, contact us at help@freespoke.com — the API requires
the `podcast_search` capability to be enabled for your organization.

## How it works

Both modes return ordered **episodes**:

- **Semantic**, the default, matches transcript meaning and returns specific
  **transcript segments** (moments). Use it for topics and contextual questions.
- **Keyword** matches episode and series metadata, including titles, speaker and
  host names, descriptions, and episode numbers, plus literal transcript words.
  Transcript matches include supporting segments; a mention is not a speaker claim.

Every episode, result, series and segment has an opaque token. Tokens are stable
for the same reference while the service's encryption key is unchanged.
Store them to de-duplicate episodes or call `GetPodcast` later. Key rotation
invalidates existing tokens.

There are two endpoints:

- `POST /api/v1/podcast` — search.
- `POST /api/v1/podcast/episode` — re-hydrate a stored token.

## Base URL and authentication

All endpoints are served over HTTPS at the Partner API base URL:

```
https://api.partners.freespoke.com
```

Every request needs a bearer token in the `Authorization` header. See
[Authentication](/developers/partner-api#authentication) in the Partner API
guide for how to obtain one (API key or OAuth2 client-credentials grant).

```
Authorization: Bearer <token>
```

## Identifiers

Search results carry several opaque tokens. Understanding which to store is the
key to using the API well.

| Token | Where it appears | What it unlocks |
|-------|------------------|-----------------|
| `episodeId` | `PodcastEpisode.episodeId` | The episode alone. Re-fetch episode **metadata only** (no segments). Useful for de-duplicating episodes and refreshing episode details. |
| `resultId` | `PodcastEpisode.resultId` | The episode **plus the segments it matched**. This is the token you store to re-hydrate a search result's moments. |
| segment `id` | `TranscriptSegment.id` | A single matched segment. Used to request a subset of a result's segments. |
| series `id` | `PodcastSeries.id` | The series (show). A stable handle for de-duplicating shows. |

A `resultId` encodes the episode and its matched segment references. Results
for the same episode can have different `resultId`s when those references differ;
use `episodeId` to recognize the episode across searches. Keyword results include
segment references only when transcript words support the match.

## Search

`POST /api/v1/podcast`

### Request

```json
{
  "query": "artificial intelligence regulation",
  "max_results": 5,
  "max_segments": 3,
  "max_episodes_per_series": 3
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `query` | string | — | Required on the first request; repeat it unchanged on continuation. A topic/question for Semantic, or metadata/transcript words for Keyword. |
| `max_results` | int | 20 | Maximum episodes to return. Values above 100 are coerced to 100. |
| `max_segments` | int | 3 | Maximum matched transcript segments per episode (1–20). Applies to transcript matches in either mode. |
| `max_episodes_per_series` | int | 3 | Limit per show (1–10). Keyword applies it per page and defers excess episodes; Semantic applies it to the candidate set before paging. |
| `search_type` | enum | Semantic | `PODCAST_SEARCH_TYPE_SEMANTIC` or `PODCAST_SEARCH_TYPE_KEYWORD`; omitted/unspecified means Semantic. |
| `date_filter` | object | last month | Restricts results by publish date. Omitted, results cover the last month. See [Filtering by date](#filtering-by-date). |
| `series_ids` | string[] | — | Opaque series ids (a result's `series.id`) to restrict the search to specific shows. Omitted or empty, all eligible series are searched. See [Filtering by series](#filtering-by-series). |
| `page_token` | string | — | An opaque cursor from a previous response's `nextPageToken`. When set, all other parameters must match the originating call. |
| `include_unenriched` | bool | false | Reserved for future use; no effect today. |

Numeric limits of zero or less use their defaults. Requests may return fewer
than `max_results` episodes. Both modes search enriched episodes only; Keyword
never invokes Semantic retrieval.

### Semantic response

Illustrative content and opaque tokens:

```json
{
  "results": [
    {
      "episodeId": "8Kx2p...opaque...",
      "resultId": "Qz7fB...opaque...",
      "title": "The Future of AI Policy",
      "description": "A conversation about where AI regulation is headed.",
      "publishTime": "2026-01-15T10:30:00Z",
      "speakerNames": ["Jane Host", "John Guest"],
      "runtimeSec": 3612.0,
      "audioUrl": "https://cdn.example.com/podcasts/ep-1234.mp3",
      "series": {
        "id": "S9aQ1...opaque...",
        "title": "Tech Talk Weekly",
        "description": "Weekly conversations about technology and society.",
        "homepageUrl": "https://techtalk.example.com",
        "rssUrl": "https://techtalk.example.com/feed.rss",
        "images": [
          { "url": "https://cdn.example.com/series/tech-talk.jpg", "type": "TYPE_THUMBNAIL" }
        ]
      },
      "transcriptSegments": [
        {
          "id": "T3mN8...opaque...",
          "text": "When we talk about regulating artificial intelligence, the first question is scope.",
          "chapterTitle": "What Are We Regulating?",
          "summary": "The hosts frame the regulatory debate.",
          "offsetChar": 10432,
          "lengthChar": 512,
          "offsetTimeMs": 742000,
          "lengthTimeMs": 38000,
          "score": 0.87
        }
      ]
    }
  ],
  "nextPageToken": "<cursor>"
}
```

### Example

```bash
curl -X POST https://api.partners.freespoke.com/api/v1/podcast \
  -H "Authorization: Bearer $PARTNERS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "query": "artificial intelligence regulation", "max_results": 5, "max_segments": 3 }'
```

### Keyword search

Set `search_type` explicitly. This example searches all publication dates;
omitting `date_filter` would keep the API's last-month default.

```json
{
  "query": "The Future of AI Policy",
  "search_type": "PODCAST_SEARCH_TYPE_KEYWORD",
  "date_filter": { "range": {} },
  "max_results": 5
}
```

Confident show lookups return the newest eligible episodes within the requested
scope and dates. Supported person and specific-episode matches receive priority;
ambiguous queries retain lexical search. Complete-name matches may discuss a
person without establishing that they participated. Preserve the returned order.

An illustrative Keyword result (with placeholder content and tokens):

```json
{
  "results": [
    {
      "episodeId": "8Kx2p...opaque...",
      "resultId": "8Kx2p...opaque...",
      "title": "The Future of AI Policy",
      "series": { "id": "S9aQ1...opaque...", "title": "Tech Talk Weekly" },
      "promoted": true,
      "matchedOn": ["PODCAST_MATCH_FIELD_EPISODE_TITLE"],
      "matchEvidence": [
        {
          "field": "PODCAST_MATCH_FIELD_EPISODE_TITLE",
          "parts": [{ "text": "The Future of AI Policy", "matched": true }]
        }
      ]
    }
  ]
}
```

Keyword transcript matches carry `transcriptSegments`. Optional `matchEvidence`
contains plain-text excerpts from current metadata; it is not HTML or a generated
explanation. Concatenate each excerpt's `parts` and style runs whose `matched`
value is true. A missing `matched` means false. Results remain displayable when
evidence is absent. See [Match attribution and evidence](#match-attribution-and-evidence).

### Pagination

If more results are available, the response includes a `nextPageToken`. Pass it
back as `page_token`, repeating the original query, mode, dates, series scope and
limits. A token-only request does not restore the original search; changed
parameters invalidate continuation. An empty or omitted `nextPageToken` ends it.

Follow the cursor even after a short page. Keyword's per-series page limit can
defer eligible episodes to later pages. Continuation ends at the bounded
candidate pool; it does not enumerate the full catalogue or freeze a database
snapshot. Each request reruns retrieval, and relative date filters move with
request time. Use an absolute range when you need a fixed publication window.

### Filtering by date

By default, search returns episodes published in the **last month**. To search a
different window, include a `date_filter` in one of two forms.

**Freshness** — a rolling window measured back from the request time:

```json
{ "query": "...", "date_filter": { "freshness": "FRESHNESS_YEAR" } }
```

Values: `FRESHNESS_DAY`, `FRESHNESS_WEEK`, `FRESHNESS_MONTH`, `FRESHNESS_YEAR`.

**Range** — explicit calendar bounds; either side may be omitted:

```json
{
  "query": "...",
  "date_filter": {
    "range": {
      "start": { "year": 2025, "month": 1, "day": 1 },
      "end":   { "year": 2025, "month": 12, "day": 31 }
    }
  }
}
```

The range includes the end date. To search the full history, send an empty
range:

```json
{ "query": "...", "date_filter": { "range": {} } }
```

### Filtering by series

By default, search covers all available series. To restrict it to specific
shows, pass one or more opaque series ids — the `id` from a result's `series` —
in `series_ids`. A nonempty list restricts the search to those shows; omitted or
empty searches all eligible shows.

```json
{ "query": "...", "series_ids": ["S9aQ1...opaque..."] }
```

Because results default to the last month, scoping to a single series returns
nothing when that series has no episodes from the past month. To search a
series' full catalog, combine `series_ids` with a wider `date_filter` — for
example an empty `range`:

```json
{ "query": "...", "series_ids": ["S9aQ1...opaque..."], "date_filter": { "range": {} } }
```

## Get episode

`POST /api/v1/podcast/episode`

Fetches an episode from a token. Provide **exactly one** of `episode_id` or
`result_id`, and optionally a `segment_ids` list to select which segments to
return.

| You send | You get back |
|----------|--------------|
| `result_id` | Episode metadata and the segments encoded in that result (when present in either search mode). |
| `result_id` + `segment_ids` | Episode metadata and the selected subset of that result's segments. |
| `episode_id` | Episode metadata; no transcript segments. |

### By result

Returns all of a result's matched segments.

```json
{
  "result_id": "Qz7fB...opaque..."
}
```

### By result, narrowed to a subset

`segment_ids` are opaque `TranscriptSegment.id` values, each one of the segments
encoded in `result_id`. Supplying an id outside that set, or any `segment_ids`
together with an `episode_id`, returns `400 Bad Request`.

```json
{
  "result_id": "Qz7fB...opaque...",
  "segment_ids": ["T3mN8...opaque..."]
}
```

### By episode (metadata only)

Returns episode metadata — title, publish time, series, audio URL — with **no
transcript segments**. A token containing segment references is rejected when
sent as `episode_id`; send it as `result_id` instead. The API does not provide
full-transcript retrieval.

```json
{
  "episode_id": "8Kx2p...opaque..."
}
```

### Response

The response is a single `result` with the same shape as a search result. Its
`transcriptSegments` contains only the requested segments (empty or omitted for
an `episode_id` or a result with no matched passages). `matchEvidence` is search-time context and is
not returned by this endpoint: stored references contain neither the query nor
its metadata excerpts.

```json
{
  "result": {
    "episodeId": "8Kx2p...opaque...",
    "resultId": "Qz7fB...opaque...",
    "title": "The Future of AI Policy",
    "publishTime": "2026-01-15T10:30:00Z",
    "audioUrl": "https://cdn.example.com/podcasts/ep-1234.mp3",
    "series": { "id": "S9aQ1...opaque...", "title": "Tech Talk Weekly" },
    "transcriptSegments": [
      {
        "id": "T3mN8...opaque...",
        "text": "When we talk about regulating artificial intelligence, the first question is scope.",
        "chapterTitle": "What Are We Regulating?",
        "offsetTimeMs": 742000,
        "lengthTimeMs": 38000
      }
    ]
  }
}
```

### Example

```bash
curl -X POST https://api.partners.freespoke.com/api/v1/podcast/episode \
  -H "Authorization: Bearer $PARTNERS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "result_id": "Qz7fB...opaque..." }'
```

## Field reference

### Episode

| Field | Type | Description |
|-------|------|-------------|
| `episodeId` | string | Opaque episode token (metadata-only re-fetch, de-dupe). |
| `resultId` | string | Opaque result token (episode + matched segments). |
| `title` | string | Episode title. |
| `description` | string | Episode description. |
| `publishTime` | string | RFC 3339 publish timestamp. |
| `speakerNames` | string[] | Speakers/guests, when known. |
| `runtimeSec` | number | Full episode runtime, in seconds. |
| `audioUrl` | string | The original audio enclosure URL for the episode. |
| `series` | object | The series (show); see below. |
| `images` | object[] | Artwork; see below. |
| `transcriptSegments` | object[] | Matching segments for Semantic or Keyword transcript matches; empty or omitted on metadata-only retrieval. |
| `promoted` | bool | Deliberately prioritized as a known-item match; not a confidence score. |
| `matchedOn` | enum[] | Supported match sources; see below. Does not establish a person's role. |
| `matchEvidence` | object[] | Optional search-time metadata excerpts; omitted by `GetPodcast`. |

### Match attribution and evidence

`matchedOn` can include `PODCAST_MATCH_FIELD_SERIES_TITLE`,
`PODCAST_MATCH_FIELD_EPISODE_TITLE`, `PODCAST_MATCH_FIELD_SPEAKER_NAME`,
`PODCAST_MATCH_FIELD_EPISODE_NUMBER`, `PODCAST_MATCH_FIELD_EPISODE_DESCRIPTION`,
`PODCAST_MATCH_FIELD_TRANSCRIPT`, or `PODCAST_MATCH_FIELD_SEMANTIC`. A title, description or transcript mention alone does not
establish a speaker match or guest participation. `promoted` describes deliberate
known-item prioritization, not relevance confidence.

Each `matchEvidence` entry identifies one metadata `field` and ordered `parts`.
Every part has literal `text` and an optional `matched` boolean. There are at most
three excerpts per result, each with at most 32 parts and 320 Unicode characters
in total. Render text safely and apply your own highlighting; do not treat it as
markup. Transcript matches use their returned segments instead. Keyword BM25
scores and Semantic similarity scores are different quantities; do not compare
them with each other or with metadata scores.

### Transcript segment

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Opaque segment token. |
| `text` | string | The transcript text of the segment. |
| `chapterTitle` | string | Generated chapter title for the segment. May be empty. |
| `summary` | string | Generated summary for the segment. May be empty. |
| `offsetChar` | int | Start offset, in characters, within the full episode transcript. |
| `lengthChar` | int | Length of the segment text, in characters. |
| `offsetTimeMs` | int | Start offset into the episode audio, in milliseconds. |
| `lengthTimeMs` | int | Segment duration, in milliseconds. |
| `score` | number | Relevance score for the segment against the query. |

### Series

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Opaque series token. |
| `title` | string | Series title. |
| `description` | string | Series description. |
| `homepageUrl` | string | Series homepage URL. |
| `rssUrl` | string | Series RSS feed URL. |
| `images` | object[] | Series artwork. |

### Image

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Image URL. |
| `type` | string | Image type (for example `TYPE_THUMBNAIL`). |

## Typical workflow

1. **Search** with `POST /api/v1/podcast`.
2. **Store** the `resultId` for each result you want to keep (and the
   `episodeId` if you want to de-duplicate or refresh metadata).
3. **Display** later by calling `POST /api/v1/podcast/episode` with the stored
   `resultId`, optionally selecting specific `segment_ids`.

## Error handling

Expect standard HTTP status codes:

- `400` for invalid requests — a missing `query`, a `segment_ids` entry outside
  the result's set, or `segment_ids` supplied with an `episode_id`.
- `401` / `403` for authentication and authorization failures, including
  missing the `podcast_search` capability.
- `404` when a referenced episode no longer exists.
- `500` for server errors.

Retry transient errors (5xx or network timeouts). Do not retry 4xx errors
without correcting the request.

## Support and onboarding

To integrate you will need Partner API credentials (an API key or OAuth2 client
credentials) with the `podcast_search` capability enabled for your
organization. Contact us at help@freespoke.com to get started.
