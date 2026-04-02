---
title: WordPress Plugin
description: Embed the Freespoke Search Widget and auto-publish content to Freespoke from WordPress
sidebar:
    order: 2
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

- **On publish** — posts are submitted immediately when published or scheduled.
- **Background cron** — periodically re-indexes posts that haven't been submitted since the current epoch, and polls pending job statuses.
- **Failure notifications** — configurable email recipients are notified when submissions fail.

Submission status is visible per-post in the block editor and on the **Tools → Freespoke Publisher** admin page.

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
| `min_height` | Minimum container height (CSS value, e.g. `400px`). |

Theme colors, fonts, and border radius can also be customized. See the [Search Widget](/developers/search-widget/#theme-customization) documentation for the full list of styling options.

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

## Support

For API access or questions, contact your Freespoke partner representative or email help@freespoke.com.
