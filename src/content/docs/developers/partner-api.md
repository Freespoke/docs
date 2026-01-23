---
title: Partner API
description: Integrating with the Freespoke Partner API
sidebar:
    order: 1
---

# Partner API integration guide

The Freespoke Partner API lets publishers submit content for indexing and monitor indexing status. This guide is for external developers building a direct integration.

If you would like to integrate the Freespoke Partner API, contact us at help@freespoke.com.

## Base URL

All endpoints are served over HTTPS:

```
https://api.partners.freespoke.com
```

## Authentication

All requests require a bearer token:

```
Authorization: Bearer <token>
```

Treat the token like a password. Do not embed it in client-side apps. If you need a token, contact Freespoke.

## Data model

### Article (index request)

Required fields:

- `url` (string, absolute URL)
- `title` (string)
- `content` (string)
- `publish_time` (RFC3339 timestamp)
- `authors` (array with at least one author)

Optional fields:

- `description` (string)
- `keywords` (array of strings, max 32)
- `image_url` (string, absolute URL)
- `content_medium` (string enum; use `MEDIUM_WEBPAGE`)

Notes:

- Your `url` must belong to a domain approved for your organization.
- HTML content is accepted; the API will normalize it for indexing.
- Use UTC timestamps (for example `2024-01-01T00:00:00Z`).

### Author (person)

Required fields:

- `name` (string)

Optional fields:

- `id` (string)
- `url` (string)
- `bias` (float)
- `twitter_id` (string)
- `facebook_id` (string)

## Indexing flow

Indexing is asynchronous. You submit an article, receive a job ID, then poll job status.

### 1) Submit content

`POST /v1/content`

Example:

```bash
curl -X POST https://api.partners.freespoke.com/v1/content \
  -H "Authorization: Bearer $PARTNERS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "title": "Example Title",
    "description": "Short summary",
    "content": "<p>Hello world</p>",
    "authors": [
      { "id": "author-1", "name": "Jane Doe" }
    ],
    "keywords": ["news", "example"],
    "publish_time": "2024-01-01T00:00:00Z",
    "image_url": "https://example.com/image.jpg",
    "content_medium": "MEDIUM_WEBPAGE"
  }'
```

Response:

```json
{
  "jobId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "workflowId": "partner-ingest/123456"
}
```

If the request fails validation or is rejected, the response may include `errorMessage`.

### 2) Poll job status

`GET /v1/job/{job_id}`

Example:

```bash
curl -H "Authorization: Bearer $PARTNERS_API_TOKEN" \
  https://api.partners.freespoke.com/v1/job/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
```

Response:

```json
{
  "job": {
    "jobId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "status": "JOB_STATUS_COMPLETE",
    "createTime": "2024-01-01T00:00:00Z",
    "updateTime": "2024-01-01T00:00:10Z",
    "error": { "code": 0, "message": "", "details": [] },
    "metadata": { "@type": "type.googleapis.com/...", "value": "..." },
    "result": { "@type": "type.googleapis.com/...", "value": "..." }
  }
}
```

Status values:

- `JOB_STATUS_PENDING`
- `JOB_STATUS_COMPLETE`
- `JOB_STATUS_FAILED`

## Epoch (re-indexing)

The API exposes an epoch to help you detect when re-indexing is required.

`GET /v1/content/epoch`

```bash
curl -H "Authorization: Bearer $PARTNERS_API_TOKEN" \
  https://api.partners.freespoke.com/v1/content/epoch
```

Response:

```json
{ "epoch": 1704067200 }
```

Recommended usage:

1) Record the epoch value when you submit content.
2) Periodically fetch the latest epoch.
3) If the latest epoch is greater than your recorded value, re-submit the content.

## Error handling

Expect standard HTTP status codes:

- `400` for invalid requests
- `401/403` for authentication and authorization failures
- `404` for unknown endpoints or jobs
- `500` for server errors

Use retries for transient errors (5xx or network timeouts). Avoid retrying 4xx errors without correcting the request.

## Not yet implemented

The following endpoints exist in the spec but are not currently supported:

- `DELETE /v1/content/{id}`
- `POST /v1/status`

If you need these, contact Freespoke support.

## Client libraries

- PHP: https://github.com/Freespoke/partner-api-php

## Support and onboarding

To integrate, you will need:

- An API token
- Your publishing domains allow-listed

If you are ready to start or need help, contact support at help@freespoke.com.
