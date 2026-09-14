# DomainPulse Backend Architecture

## Architecture baseline

DomainPulse uses a TypeScript npm-workspace monorepo. The backend is a NestJS modular monolith running on the Fastify HTTP adapter. Product resources use the versioned REST namespace `/api/v1`; infrastructure endpoints such as `/health` remain outside that namespace.

The application begins as two deployment units sharing domain and infrastructure packages:

- `apps/api`: synchronous HTTP API.
- `apps/worker`: future PostgreSQL-backed scheduler and job processor.

Server-only PostgreSQL infrastructure lives in `packages/database`. It may be
consumed by backend processes such as `apps/api`, but never by `apps/web`, a
future mobile application, or `packages/contracts`. See
[`database.md`](./database.md) for the connection, migration, and storage
conventions established in Phase 2.

Microservices are not the default. Modules can be extracted only when operational evidence justifies independent deployment.

## First-class clients

Web and Mobile are first-class clients of the same API:

```text
React Web ─────┐
               ├── DomainPulse REST API ── application/domain services
React Native ──┘
```

Business APIs and services must not contain browser-specific or mobile-specific branches. Browser cookie and CSRF mechanics belong at the HTTP authentication boundary. A future React Native/Expo client can use a token and Authorization Code with PKCE flow while sharing the same principals, authorization policies, workspace rules, and resource endpoints.

`packages/contracts` contains only runtime-validatable, transport-safe schemas and types. It must remain consumable by browsers, React Native/Expo, and Node without importing Node-only APIs, filesystem modules, database records, credentials, server configuration, or raw provider payloads.

Mobile foundation begins as soon as core portfolio APIs are stable; it does not wait for provider integrations.

## Data and tenancy plan

PostgreSQL and Drizzle are planned for Phase 2. Every portfolio resource will be workspace-scoped. Phase 2 prepares tenant keys and policies; Phase 3 activates PostgreSQL row-level security alongside authentication, membership authorization, and tenant-isolation tests.

The relationship architecture is hybrid:

- explicit foreign keys enforce structural invariants;
- a typed portfolio-entity registry gives generic relationship endpoints referential integrity;
- a relationship table represents flexible infrastructure mappings.

Frontend fixtures are UI/reference material only. Their IDs are not canonical, contradictions are not backend truth, and they will not be imported into the production database.

## Provenance and operational state

The provenance vocabulary is `USER_ADDED`, `USER_MAPPED`, `IMPORTED`, `PROVIDER_API`, `RDAP_RETRIEVED`, `DNS_RETRIEVED`, `SSL_RETRIEVED`, and `CALCULATED`. Phase 1 defines no persistence model. Core provenance records arrive with the database foundation; full field-level evidence is deliberately deferred.

Inventory lifecycle, relationship mapping coverage, monitoring configuration, and monitoring results are permanently separate concepts. An inventoried and mapped resource can correctly have monitoring status `NOT_CONNECTED` and live health `UNKNOWN`.

## Integrations, jobs, and secrets

Provider implementations conform to a capability-based adapter contract.
Provider-specific authentication, payloads, errors, and normalization remain
behind that boundary; the concrete runtime rules are documented in
[`provider-integrations.md`](./provider-integrations.md).

The initial job system will use PostgreSQL with a separately deployed worker, durable leases, retries, deduplication, and idempotent handlers. Redis is not a Phase 1 dependency and is added only if demonstrated workload requirements justify it.

Secrets remain backend-only. Client contracts never contain provider credentials, API tokens, passwords, private keys, environment values, database types, or vault payloads. Credential metadata will be separated from encrypted secret material behind a future vault abstraction.

## Frontend migration

Each frontend feature will gain a repository interface with two implementations: the existing fixture source and a generated API client. Features move one vertical slice at a time, beginning with domain list/detail. View-model formatting stays in the client. The frozen `demo-v1.0` tag and `demo-stable` branch remain recoverable and untouched.

## Roadmap

1. Phase 0 — Architecture Audit
2. Phase 1 — Backend Foundation
3. Phase 2 — PostgreSQL/Drizzle
4. Phase 3 — Auth/Workspace/RLS
5. Phase 4 — Core Entities
6. Phase 5 — Relationships/Provenance
7. Phase 6 — REST APIs
8. Phase 7 — Web Domains API Slice
9. Phase 8 — Mobile Foundation
10. Phase 9 — Mobile Core
11. Phase 10 — Job Queue/Worker
12. Phase 11 — RDAP/DNS/TLS
13. Phase 12 — Discovery/Pricing
14. Phase 13 — Provider Framework
15. Phase 14 — Provider Integrations
16. Phase 15 — Alerts/Push
17. Phase 16 — Monitoring
18. Phase 17 — Production Hardening
19. Phase 18 — Advanced Mobile/Web Sync
