# DomainPulse Database Foundation

## Scope and package boundary

DomainPulse uses PostgreSQL as its canonical relational store and Drizzle ORM
for typed queries and reviewed SQL migrations. `packages/database` is a
server-only workspace. It owns environment validation, the `pg` connection
pool, the Drizzle client, transaction helpers, readiness checks, schema source,
and migration artifacts.

The allowed dependency direction is:

```text
packages/contracts  <---  apps/api, apps/web, future apps/mobile
packages/database   <---  apps/api, future backend workers
```

`apps/web`, future mobile clients, and `packages/contracts` must never import
`packages/database`. Transport contracts contain only JSON-safe values and do
not expose PostgreSQL, Drizzle, Node.js, or internal database types.

Phase 2 intentionally defines no product tables and no RLS policies. User,
authentication, workspace, membership, tenant-isolation, portfolio,
relationship, provenance, provider, monitoring, and job schemas are deferred.

## Runtime configuration

The API requires `DATABASE_URL` at startup. It must use `postgresql://` or
`postgres://`. The checked-in `.env.example` contains documentation-only
credentials; real values belong in the deployment secret manager or an ignored
local environment file.

The optional pool settings have bounded defaults:

| Variable | Default | Allowed range | Meaning |
| --- | ---: | ---: | --- |
| `DATABASE_POOL_MAX` | 10 | 1–100 | Maximum connections held by one API process |
| `DATABASE_IDLE_TIMEOUT_MS` | 30000 | 1000–300000 | Idle connection lifetime |
| `DATABASE_CONNECTION_TIMEOUT_MS` | 5000 | 100–60000 | Maximum connection attempt time |

There is deliberately no pool-minimum setting. `pg` creates connections on
demand, so a nominal minimum would not provide a useful eager-warm guarantee.

Validation errors identify invalid environment-variable names but never echo
their values. Sanitized configuration replaces the complete connection string
with `[REDACTED]`. The URL must never be included in application logs, HTTP
errors, metrics labels, or client responses.

`TEST_DATABASE_URL` is separate and optional. It is used only by real database
integration tests. Tests refuse URLs whose database name does not clearly
contain a `test` segment and refuse a value equal to `DATABASE_URL`.

## Connection lifecycle

Each API process constructs one `DatabaseService`, which owns one reusable
`pg.Pool` and one Drizzle database instance:

```text
API construction -> validate environment -> create pool and Drizzle client
requests         -> reuse the process pool
shutdown         -> Nest shutdown hook -> close the pool exactly once
```

Pool construction is lazy with respect to network I/O. API liveness can start
even while PostgreSQL is temporarily unavailable. `ping()` runs `SELECT 1`,
maps low-level connection failures to a safe internal error, and is used by
readiness. Idle-client pool errors are reduced to a credential-free structured
event so they cannot become an unhandled process error or leak driver details.
No connection is created per request.

The package exposes controlled access to the Drizzle database, pool, `ping`,
`transaction`, and idempotent `close` operations. Direct pool access is for
infrastructure needs such as migrations and diagnostics; application data
access should normally use typed Drizzle queries and repository boundaries.

## Liveness and readiness

`GET /health` remains process liveness only. It does not query PostgreSQL and
continues returning HTTP 200 with:

```json
{"status":"ok","service":"domainpulse-api"}
```

`GET /ready` represents dependency readiness. A successful database ping
returns HTTP 200:

```json
{"status":"ready","service":"domainpulse-api","database":"available"}
```

A failed ping returns HTTP 503 with only stable, client-safe fields:

```json
{"status":"not_ready","service":"domainpulse-api","database":"unavailable"}
```

The unavailable response never includes the host, port, database name,
username, password, connection URL, driver error, or stack trace.

## Schema and storage conventions

- IDs are canonical PostgreSQL UUIDs. UI fixture identifiers are never treated
  as production identifiers.
- Instants use PostgreSQL `timestamptz`; API and backend values use ISO-8601 UTC.
- Money uses integer minor units plus an explicit ISO currency code. Formatted
  currency strings such as INR display values are never canonical storage.
- Domain names store a normalized ASCII/punycode canonical form. Original or
  display forms are separate fields when required.
- IP addresses use PostgreSQL `inet` when address semantics are required.
- PostgreSQL identifiers use `snake_case`; TypeScript properties use
  `camelCase`. Drizzle provides the mapping boundary.
- Portfolio and synchronized provider records use explicit archival or
  lifecycle semantics. They are not casually hard-deleted.
- JSONB is reserved for provider-specific or non-query-critical metadata. It
  does not replace relational columns for core entities or relationships.

These conventions are locked before product schema work so Phase 3 tables are
consistent from their first reviewed migration.

## Transactions

`DatabaseClient.transaction()` delegates to a real Drizzle transaction and
passes a transaction-scoped database object to the operation. Successful
callbacks commit; thrown errors roll back and propagate. Future compound writes
such as canonical entity + relationship + provenance + audit event must share
one transaction callback. Phase 2 contains no product transactions.

## Migration workflow

Schema source is `packages/database/src/schema/`. Generated SQL is written to
`packages/database/migrations/`. The supported commands are:

```text
npm run db:generate   # generate SQL from Drizzle schema changes
npm run db:check      # verify migration history consistency
npm run db:migrate    # apply reviewed migrations using DATABASE_URL
```

There are intentionally no normal `db:push`, `db:drop`, or `db:reset` commands.
Phase 2 keeps the schema free of tables and the migration journal free of SQL
entries rather than inventing a table solely to produce a migration.

Development workflow:

```text
edit Drizzle schema
-> generate migration
-> inspect the SQL
-> test against a clean disposable PostgreSQL database
-> apply the reviewed migration
```

Production workflow:

```text
take/verify backup or checkpoint
-> deploy reviewed migration with the migration role
-> verify database and API readiness
-> deploy application code
```

If a migration fails, stop the rollout, retain the exact failure evidence,
verify database state, and decide between a safe retry and a reviewed forward
fix. Generic DOWN migrations are not assumed safe; reversing a change may lose
data. Prefer a forward-fix migration when rollback would be destructive.

## Security rules

- Runtime credentials follow least privilege; a separate migration role may
  own DDL permissions.
- Production connections require PostgreSQL TLS according to the hosting
  platform policy. Local plaintext connections remain loopback-only.
- Credentials are supplied through environment injection or a secret manager,
  never source control.
- Connection strings and low-level driver errors are excluded from logs and
  HTTP responses.
- Drizzle and `pg` parameterization are required for values. Raw SQL identifiers
  require an explicit trusted allow-list or a fixed internal constant.
- PostgreSQL RLS is planned for Phase 3 alongside auth, workspace, membership,
  and tenant-isolation tables. Fake policies without tenant tables are forbidden.

## Local development and integration testing

Provide a PostgreSQL runtime yourself; repository scripts do not install or
start PostgreSQL, Docker, or Podman. Configure `DATABASE_URL`, start the API,
and use `/ready` to confirm connectivity.

Real integration tests execute only when `TEST_DATABASE_URL` identifies a
disposable test database. They verify connection, `SELECT 1`, commit, rollback,
readiness, pool shutdown, and reopen. Without that variable the suite is marked
skipped/not executed; mocks are never reported as PostgreSQL integration success.
