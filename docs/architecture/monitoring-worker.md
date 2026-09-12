# PostgreSQL monitoring worker

## Process and ownership

Phase 9C adds `apps/worker` as a separate Node process without an HTTP server.
PostgreSQL is both the durable schedule and queue. The worker polls every 60
seconds by default, recovers expired leases, schedules eligible targets, then
claims at most the smaller of its claim-batch and concurrency limits. All
configuration is validated before use; concurrency defaults to five.

The worker reuses the Phase 8 `RdapClient`, `DnsClient`, `TlsClient`, public
network protections, and `PostgresMetadataRepository`. Retrieval tests use
fakes and never contact external services. No retrieval payload is stored in
`monitoring_runs`, and existing metadata persistence continues to preserve the
last usable snapshot when a later attempt fails.

## Queue and RLS boundary

Migration 0009 creates three narrow `SECURITY DEFINER` functions. Scheduling
locks only due enabled targets whose domain remains TRACKED, inserts a stable
scheduled idempotency key, and advances `next_run_at` by the configured check
interval plus deterministic 0–300 second jitter. Claiming atomically changes
due QUEUED rows to RUNNING and commits their lease before network work begins.
Recovery atomically marks expired RUNNING rows FAILED and conditionally adds a
deduplicated retry. All selectors use deterministic ordering and
`FOR UPDATE SKIP LOCKED` for multi-worker safety.

These functions return only run, workspace, target, and domain identifiers,
plus the attempt/key/lease fields required after claim. PUBLIC execution is
revoked. Deployment grants their exact signatures only to the dedicated
worker role described in `database-roles.md`. That role is a non-owner
`NOBYPASSRLS` login. After a global claim, all domain reads, metadata writes,
run finalization, target updates, and retry inserts use transaction-local
`withWorkspaceContext` and normal RLS.

## Execution and terminal state

RDAP, DNS, and TLS execute independently. SUCCESS means all three produced
usable SUCCESS results. PARTIAL means at least one source produced usable
evidence and at least one was PARTIAL or FAILED; DNS PARTIAL is usable evidence.
FAILED means no source produced usable evidence. Only normalized source names,
a canonical safe error code, duration, and timestamps are stored on the run.

SUCCESS resets `consecutive_failures` to zero. PARTIAL and FAILED increment it,
making the counter a consecutive non-success streak. Transient failures alone
are retryable. Attempts 2, 3, and 4 use exact 5-, 20-, and 60-minute delays;
per-target idempotency prevents duplicate retries. Invalid domains, unsupported
TLDs, unsafe addresses, and validation failures are permanent.

SIGINT and SIGTERM stop new polling/claims, allow already claimed work to
finish, and close the shared PostgreSQL pool exactly once. A run that outlives
its lease cannot finalize over a later recovery; it is handled by deterministic
lease recovery instead. Phase 9C does not evaluate alerts or expose APIs.
