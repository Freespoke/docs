---
title: Freespoke Crawler
description: Information on the Freespoke Web Crawler
sidebar:
    order: 999
---

Freespoke crawls the web to provide results to our search engine.

## What Is Freespoke?

Freespoke is a web search engine that believes in balanced results, and strives
to show you the full story.

## Why is Freespoke crawling my site?

Freespoke collects information from thousands of sites across the web to provide
our unique results.

## How does Freespoke identify itself?

Our crawler makes requests using its unique user agent:

```
Mozilla/5.0 (compatible; Freespoke/2.0; +https://docs.freespoke.com/search/bot)
```

## How do I stop Freespoke from crawling my site?

Freespoke strives to be a polite web crawler. We obey your instructions in a
`robots.txt` file. If you'd like to prevent Freespoke from reading a portion of
your site, create a `robots.txt` file in the root directory of your site (e.g.
at `mysite.com/robots.txt`), and add a rule for `User-agent: Freespoke`:

```
User-agent: Freespoke
Disallow: /my-private-page
```

To learn more about the Robots file, click <a href="https://en.wikipedia.org/wiki/Robots.txt" target="_blank">here</a>.

## Will Freespoke slow down my site?

Freespoke's crawler is designed to fetch pages at a rate which will not impact
your website. If you are concerned about the rate at which Freespoke fetches your
page, you can control the interval between fetches using the
<a href="https://en.wikipedia.org/wiki/Robots.txt#Crawl-delay_directive" target="_blank">`Crawl-delay` robots directive</a>.

## Get Help

If you have further questions, please email us at help@freespoke.com and include
"Freespoke Crawler" in the subject line.
