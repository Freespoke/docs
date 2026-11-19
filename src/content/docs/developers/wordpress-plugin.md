---
title: WordPress Plugin
description: Embed the Freespoke Search Widget and auto-publish content to Freespoke from WordPress
sidebar:
    order: 3
---

# Freespoke Search WordPress Plugin

The Freespoke Search plugin lets you embed the Freespoke search widget on your WordPress site and automatically publish your content to Freespoke's search index.

**Requirements:** PHP 8.1+ and WordPress 6.0+.

## Installation

1. Download the latest release zip from the [GitHub releases page](https://github.com/Freespoke/wordpress-plugin/releases).
2. In WordPress, go to **Plugins → Add New → Upload Plugin** and upload the zip.
3. Activate **Freespoke Search**.

The plugin checks for updates automatically via GitHub releases.

## Authentication

The plugin supports the same two authentication methods as the [Partner API](/developers/partner-api/#authentication). Credentials can be set in `wp-config.php` (recommended) or in the admin UI at **Tools → Freespoke Publisher**.

### Client credentials (recommended)

Add your OAuth2 client ID and secret to `wp-config.php`:

```php
define('FREESPOKE_CLIENT_ID', 'your-client-id');
define('FREESPOKE_CLIENT_SECRET', 'your-client-secret');
```

The plugin handles the token exchange and refresh automatically using the [OAuth 2.0 Client Credentials Grant](https://datatracker.ietf.org/doc/html/rfc6749#section-4.4).

### API key

Alternatively, authenticate with a static API key:

```php
define('FREESPOKE_PUBLISHER_API_KEY', 'your-api-key');
```

## Content publishing

When credentials are configured, the plugin automatically submits posts to Freespoke's search index:

- **On publish** — posts are submitted immediately when published or scheduled. Repeated saves within a single request are collapsed into one submission.
- **On trash or permanent delete** — the plugin requests removal from the Freespoke index, using the document id recorded when the post was indexed. Restoring a trashed post re-publishes it through the normal save flow.
- **Background cron** — periodically re-indexes posts that haven't been submitted since the current epoch, and polls pending job statuses.
- **Failure notifications** — configurable email recipients are notified when submissions fail.

Submission status is visible per-post in the block editor and on the **Tools → Freespoke Publisher** admin page.

### Retry behavior

Failed submissions are classified as transient or permanent. Transient failures (timeouts, `429 Too Many Requests`, `5xx`, and network errors) are retried automatically by the background cron. Permanent failures (most `4xx` responses and validation errors that won't change on retry) are not retried until the post is edited again, preventing the cron from resubmitting a request that will keep failing.

### Test mode

Enable **Test Mode** at **Tools → Freespoke Publisher** (or lock it via the `FREESPOKE_TEST_MODE` constant) to validate the integration without publishing real content. Submissions are processed end-to-end but the resulting content is not stored by Freespoke. A notice is shown in the admin while test mode is active.

### Post types

By default the plugin publishes `post` content types. To include pages or custom post types, set the `FREESPOKE_POST_TYPES` constant or configure it in the admin UI:

```php
define('FREESPOKE_POST_TYPES', 'post,page,custom_type');
```

## Search widget

### Shortcode

Add the Freespoke search widget anywhere using the `[freespoke_search]` shortcode:

```
[freespoke_search client_id="YOUR_CLIENT_ID" theme="light" placeholder="Search the news..."]
```

### PHP

Render the widget directly in templates or custom blocks:

```php
use Freespoke\Wordpress\Widget;
use Freespoke\Wordpress\WidgetOptions;

$widget = Widget::getInstance();

$options = new WidgetOptions([
    'client_id' => 'YOUR_CLIENT_ID',
    'embedded_search' => true,
    'theme' => 'dark',
    'min_height' => '400px',
]);

echo $widget->renderWidget($options);
```

Assets (JS and CSS) are enqueued automatically on first render.

### Widget options

The shortcode and PHP API accept the same options for controlling appearance and behavior:

| Option | Description |
| --- | --- |
| `client_id` | **Required.** Your widget client ID. |
| `theme` | `light` or `dark`. |
| `placeholder` | Placeholder text for the search input. |
| `embedded_search` | Show search results inline (`true`/`false`). |
| `redirect_url` | URL to redirect searches to instead of showing inline results. |
| `redirect_target` | Link target for redirects (e.g. `_blank`). |
| `auto_search` | Automatically search on page load using the query parameter (`true`/`false`). |
| `query_param` | URL query parameter name for auto-search (default: `q`). |
| `author_links` | Show links to matching author pages above the results (`true`/`false`, default `true`). See [Author links](#author-links). |
| `min_height` | Minimum container height (CSS value, e.g. `400px`). |

Theme colors, fonts, and border radius can also be customized. See the [Search Widget](/developers/search-widget/#theme-customization) documentation for the full list of styling options.

## Author links

When a visitor searches for one of your writers, the widget shows a card for that author above the results, linking to their author page on your site. A search for `jane doe` finds "Jane Q. Doe", and up to three authors are shown, most-published first.

Author links appear on a widget with both `auto_search` and `embedded_search` turned on, when the page is requested with a search query (for example `/search/?q=jane+doe`). The plugin looks up the authors when the page renders, and the cards stay up while that query's results are on screen.

```
[freespoke_search client_id="YOUR_CLIENT_ID" embedded_search="true" auto_search="true"]
```

Author links are on by default. Add `author_links="false"` to turn them off for a widget.

### What a card shows

| Field | Shown as |
| --- | --- |
| `name` | The author's name. Required. |
| `url` | Where the card links. Required. |
| `image` | A 40px circle. Use a thumbnail-sized image. |
| `title` | A line under the name, such as a job title. |
| `description` | Up to two lines under the title. |

A card shows whichever of `image`, `title`, and `description` it has. Where each field comes from depends on how your site stores authors.

### Authors as WordPress users

By default, authors are WordPress users with at least one published post, matched on their display name. The card links to the user's author archive, and the picture comes from `get_avatar_url()`, so Gravatar and local avatar plugins both work.

To fill in the title and description, or a photo kept somewhere other than the avatar, use the `freespoke_search_author` filter. It runs once per matching author with the record the plugin built, the `WP_User`, and the search query. Return the record with fields added, or `null` to leave that author out:

```php
add_filter('freespoke_search_author', function (?array $author, WP_User $user, string $query): ?array {
    $author['title']       = get_user_meta($user->ID, 'job_title', true);
    $author['description'] = get_user_meta($user->ID, 'short_bio', true);
    return $author;
}, 10, 3);
```

### Authors as a post type

Some sites keep authors as posts: an "Authors" section in the admin, one post per author with the public name as the title. Name that post type and the plugin matches on post titles instead of user display names:

```php
// wp-config.php
define('FREESPOKE_AUTHOR_POST_TYPE', 'author_profile');

// or from a theme or plugin
add_filter('freespoke_search_author_post_type', fn() => 'author_profile');
```

The slug is the `post_type` value in the address bar on the post type's list screen in the admin (`edit.php?post_type=author_profile`).

In this mode the card links to the post's permalink, the picture is the featured image, the description is the excerpt, and the bio is the content. If your author posts keep any of these in custom fields, name the fields with `freespoke_search_author_post_meta`:

```php
add_filter('freespoke_search_author_post_meta', fn() => [
    'title'       => 'job_title',
    'description' => 'short_description',
    'bio'         => 'biography',
    'image'       => 'headshot',
    'user'        => 'linked_user',
]);
```

Any subset works, and a mapped field replaces the default for that field.

- Text fields may hold HTML, as rich text editor fields do. It is converted to plain text.
- `image` may hold an attachment ID or an image URL.
- `user` links the author post to the WordPress user who writes under that name. It may hold a user ID or a login, or a list of them. When it's set, authors are ordered by those users' published post counts.

With Advanced Custom Fields, use each field's **Name** from the field group screen, not its label. ACF stores fields as post meta under that name.

`freespoke_search_author` also runs in this mode, with the author post in place of the `WP_User`.

### Replacing or reordering the list

`freespoke_search_authors` runs on the final list with the search query, including when nothing matched. Return a different list to reorder, add to, or replace the matches:

```php
add_filter('freespoke_search_authors', function (array $authors, string $query): array {
    return $authors ?: my_site_author_lookup($query);
}, 10, 2);
```

Entries need a `name` and `url`, and at most three are shown.

### Caching

Matched authors are kept in the WordPress object cache for ten minutes per query. With a persistent object cache such as Redis or Memcached, repeat searches skip the lookup. The filters run on every page load, so changes to them show immediately.

## Configuration reference

All constants are optional. When defined in `wp-config.php`, the corresponding field is locked in the admin UI.

| Constant | Description |
| --- | --- |
| `FREESPOKE_CLIENT_ID` | OAuth2 client ID |
| `FREESPOKE_CLIENT_SECRET` | OAuth2 client secret |
| `FREESPOKE_PUBLISHER_API_KEY` | API key for Partner API authentication |
| `FREESPOKE_TOKEN_URL` | Custom OAuth2 token endpoint (advanced) |
| `FREESPOKE_PUBLISHER_URL` | Custom Partner API base URL (advanced) |
| `FREESPOKE_NOTICE_EMAILS` | Comma-separated emails for failure notifications |
| `FREESPOKE_POST_TYPES` | Comma-separated post type slugs to publish |
| `FREESPOKE_AUTHOR_POST_TYPE` | Post type that holds author profiles, for [author links](#author-links) |
| `FREESPOKE_TEST_MODE` | Submit content in test mode (validated but not stored) |

## Support

For API access or questions, contact your Freespoke partner representative or email help@freespoke.com.
