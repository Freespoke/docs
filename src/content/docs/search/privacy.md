---
title: Search Privacy
description: How Freespoke provides anonymous searching.
sidebar:
    order: 1
---

Freespoke is dedicated to protecting your search privacy. Search is at the core of how we all discover the internet. Because so much of our activity online originates from search, search engine companies are uniquely positioned to take advantage of you to gather, collate, and exploit your personal information at an incredibly personal level. The largest and most powerful corporations on the planet realize this fact, and fight tooth and nail to keep your searches. Tens of billions of dollars change hands every year to nudge you towards one search engine or another. It's not because of a drive to give you the best quality result. Rather, it's to collect as much information as possible about you -- your location, your preferences, your state of mind, your purchase activity. They create a version of you in their system to predict what you will do next, and sell the opportunity to take your money to the highest bidder.

Freespoke rejects all of that. We don't care what you search for. We don't want to know who you are, or what you're searching for. We don't want to know if you're expecting a child, or about that weird thing on your toe.

All that said, we're working to build a real search engine. To do that, we need enough information to understand how well our search engine works. So we do collect some data. This document describes everything we collect, how we make sure it's anonymous, how we store it, and how we use it.

## What we do not collect

Freespoke does not collect identifying information for search. Due to how the internet works, we receive your IP address with your search requests, but aside from our security systems (for things like bot detection), it is ignored entirely. Your user ID is sent with searches, but is never stored in connection with a search request. Search events, described below, stand entirely alone. There are no user identifiers (whether your account ID or a uniquely generated psuedonym). There are no IP addresses. Searches are not linked together.

## What we share

Freespoke relies on vendors to supplement our own search results. This section describes who those vendors are, what data they receive, and why.

- **Brave**. Some of our search results come from Brave. We share your search term and anonymized location with Brave.
- **Microsoft**. We use Bing for image results, and as part of our spellchecker. Microsoft receives your search term only. If you visit our image results, your browser will load thumbnails from Microsoft servers.
- **Ad.net**. We receive syndicated advertisements from Ad.net for some search result pages. These advertisements are received via server-to-server communication. Your browser loads no resources from Ad.net unless you click on an advertisement. We share your search term and anonymized IP address with Ad.net. If you are a Freespoke Premium user with ad block enabled, Ad.net receives no signal from your searches whatsoever. See [here](https://www.ad.net/privacy-policy/) for Ad.net's privacy policy. Ad.net receives requests only when we expect it likely that an ad will be returned.

## What we collect

When you search on Freespoke, several records are made in our data analysis system. Below is a list of every event related to search, and what we store.

### Search Event

- **Search ID**. We generate a unique identifier for a search request. For the technical people, it's just a UUID.
- **Input Term**. The characters you typed into the search field, or your browser's address bar if we're the default search engine.
- **Rewritten Term**. If we think you misspelled something, or if we apply any other modifications to improve the likelihood of providing quality results, we note the difference here.
- **Main Feature**. We refer to things like web results, news results, images, videos, etc as search features. The main feature is the "tab" you're looking at. Most of the time, that's "Web". If you go to the images tab, the main feature is "Images".
- **Suggestions**. A list of spelling corrections our system suggests or applies. This is used to debug problems in our spellchecker.
- **Location**. Your location. We anonymize this by storing your geopoint at one decimal point of precision. This means we record your location within roughly a seven-mile square.
- **Source**. This records where your search originated. If we're your default search engine and you enter from the browser's address bar, or from our mobile app, we track that. For the techies, it's just the `utm_source` query parameter.
- **Timestamp**. The time at which you made your search. To make it harder to match up with other records, we add or subtract a random amount of time up to 30 minutes.
- **Logged In**. Whether you are logged in to a Freespoke Account.
- **Has Premium**. If you're logged in and a current Freespoke Premium subscriber, we note that.
- **Has Extension or App**. If you have our browser extension installed, or are using our mobile app, we note that.
- **Employee**. If you're a Freespoke employee, we track that.
- **Duration**. How long it took us to fulfill your search request.

### Search Entity

One of our processes for understanding your query is called Named-Entity recognition. It's a machine learning task that recognizes people, places, organizations, places, or companies in your search term.

A search request may contain no entities, or one or more entities. Each entity yields a single record containing the following fields:

- **Search ID**. This lets us match search events with entity records.
- **Word**. The entity name (for instance, "Alex Trebek").
- **Group**. The entity type (for instance, "Alex Trebek" would be "PERSON").
- **Model**. The ML model we used to discover the entity.

### Search Intent

One of the major components of a search engine is called Query Understanding. Query Understanding is the process of parsing your query and attempting to understand what you're looking for, and what sort of result you need, in order to show you the correct type of result. For instance, "2024 election news" should show the latest news about the election, while "red women's shoes" should probably not show news (unless something really big just happened concerning red shoes!).

We employ a variety of strategies to understand your query, and it's a major area of research and development for us. In order to continually improve our abilities, we record the outcome of our query understanding engine (we call it our Intent Engine). That record contains the following data:

- **Search ID**. The unique ID of your search, so we can see the intent outcome with your search event.
- **Term**. The rewritten search term (in order words, your term with any corrections applied).
- **News Requested**. Whether your request was configured to allow news.
- **Places Requested**. Whether your request was configured to allow places.
- **Web Provider News Match**. Whether the third-party who provides us web results chose to show news.
- **Web Provide Place Match**. Whether the third-party who provides us web results chose to show places.
- **Intent Engine Response**. The features our internal intent engine chose to display.
- **Metadata**. Additional internal information from our intent engine and supporting systems. No user data.