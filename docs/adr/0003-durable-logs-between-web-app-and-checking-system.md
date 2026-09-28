# Durable logs between the web app and the Checking System

Rule changes leave through a transactional outbox: the Alert change and its full-state rule message commit in one Postgres transaction, and a separate Rule Relay publishes the message to a log keyed by alert id. That outbound log may be compacted — only the latest message per Alert matters, and compaction lets the Checking System rebuild the complete rule set by reading it from the start.

The Checking System's messages arrive on a separate durable log consumed by a separate Event Ingest worker, which commits its read position only after its database transaction commits. The inbound log is **not** compacted: every event must stay until Ingest has applied it, so its retention must outlast the longest outage we plan to survive (Ingest down, or the Checking System delivering a long backlog at once).

Delivery in both directions is at-least-once, with idempotent effects; we do not claim exactly-once. On our side, stored Matches are deduplicated by `event_id` and Checked-through only moves forward. Because only the 20 most recent Matches per Alert are stored, `event_id` deduplication is not permanent: a replay of an older, already-pruned Match can be inserted and immediately pruned again — it cannot change the visible history or the latest Match.

The log accepting a rule message only proves it was handed over, not that the Checking System has checked the new Rule Revision.

## Considered Options

- **HTTP webhooks from the Checking System into the web servers** — rejected: a burst after a quiet spell would land on the same machines that serve pages, and retries would need their own design.
- **The Checking System pulling rules from our HTTP API** — rejected: it ties the Checking System's ability to rebuild its rule set to our web tier being up.
