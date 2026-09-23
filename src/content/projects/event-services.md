---
title: Send-back event fan-out
where: Tipalti
blurb: An action in the monolith calls out to a service, then the result fans out over Kafka to reindexing, audit, aggregation and email.
tech: ['C#', '.NET', 'Kafka', 'Elasticsearch', 'Microservices']
diagram: event-services
order: 3
---

Feature work spanning a monolith and the services around it, rather than ownership
of the messaging platform itself.
