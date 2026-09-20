---
title: London House Alarm
blurb: A precise Rightmove alert that replaces hand-drawn map searches with a real computed geofence and actual square footage filtering.
tech: ['TypeScript', 'Node.js', 'TravelTime API', 'TfL Open Data']
status: wip
featured: true
order: 1
---

Rightmove's "Draw a Search" tool means hand-tracing a shape on a map and eyeballing
whether a listing is actually within cycling distance of anywhere useful. It also has
no reliable square footage filter, so a lot of manual checking survives every search.

This computes the geofence properly instead: every tube station within 35 minutes
cycling of London Bridge via the TravelTime API, cross-referenced against TfL's open
station data, then every property within a 17 minute walk of those stations. The
geofence is computed once and cached, so the recurring job only does the scraping.

Real square footage filtering runs on top, which removes most of the remaining
manual work.
