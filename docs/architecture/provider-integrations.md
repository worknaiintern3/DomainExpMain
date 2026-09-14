# Provider Integration Architecture

## Capability boundary

Provider integrations are backend-only, capability-oriented components. The
base `ProviderAdapter` identifies a provider; token validation and domain
discovery are separate capabilities so future providers are not required to
implement operations they do not support. Provider-specific payloads remain
inside the adapter and only normalized, bounded DomainPulse values cross the
boundary.

Phase 10D implements Cloudflare API Token verification and zone discovery in
the worker codebase without wiring either into the background worker runtime.
It uses Node's native `fetch`, fixed `https://api.cloudflare.com/client/v4`
endpoints, bounded pagination and response sizes, explicit timeouts, and no
redirect following. Tokens exist only in memory and are never returned,
persisted, or logged.

## Errors and completeness

Provider failures are reduced to canonical safe codes. HTTP authentication,
permission, rate-limit, not-found, and selected upstream failures are distinct;
malformed bodies are `UPSTREAM_BAD_RESPONSE`. Only a bounded Retry-After value
is retained from a rate-limit response. Raw error bodies and payloads are never
propagated.

Zone pages are individually validated. A later-page failure or the pagination
safety ceiling produces `PARTIAL` discovery containing only validated pages.
Only an explicitly `COMPLETE` enumeration may mark previously linked resources
missing.

## Domain reconciliation

All provider network I/O completes before a short workspace-context database
transaction begins. Reconciliation uses the existing DomainPulse IDNA domain
normalizer, workspace/provider connection identity, and database-created
inventory nodes; a provider can never supply an internal node UUID.

- A new zone creates a tracked `PROVIDER_API` Domain and a stable
  `cloudflare.zone` resource link.
- An existing Domain is reused without changing its provenance.
- Only an active Cloudflare `full` zone is considered sufficient evidence to
  set the Domain's DNS provider account.
- A complete enumeration transitions absent links to
  `MISSING_FROM_PROVIDER`; it never deletes Domains.
- Reappearing links return to `ACTIVE` and clear `missing_since`.
- Stale reconciliation timestamps cannot overwrite newer link state.
