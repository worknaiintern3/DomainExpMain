# Authentication runtime

Access tokens are HS256 JWTs with exact issuer and audience validation. Runtime
configuration requires `JWT_ACCESS_TOKEN_SECRET` as the canonical base64url
encoding of 32-64 random bytes plus explicit `JWT_ACCESS_TOKEN_ISSUER` and
`JWT_ACCESS_TOKEN_AUDIENCE` values. `JWT_ACCESS_TOKEN_TTL_SECONDS` defaults to
five minutes and is bounded to 60-900 seconds. Access tokens are never stored.

Refresh rotation uses the existing `sessions` table without a migration. A
successful refresh conditionally revokes the matching active, unexpired row and
creates a successor row in the same transaction. The revoked row retains its
refresh-token hash as a reuse marker. Concurrent updates serialize on that row,
so at most one caller creates a successor.

Reuse of any revoked refresh token is treated conservatively as compromise and
revokes every still-active session for that user. Unknown and expired tokens
produce the same external authentication failure. Retained revoked/expired rows
can be removed later by the existing expiry-cleanup index and policy.

Logout idempotently revokes the session identified by the signed `sub` and
`sid` claims. There is no access-token blacklist: an already-issued access token
can remain usable until its short expiration, even after logout or refresh.

The HTTP boundary returns token pairs in JSON so the core remains usable by web
and native clients. TLS is required in deployment. Browser cookie policy and
native secure-storage integration remain transport/client concerns and are not
implemented here.
