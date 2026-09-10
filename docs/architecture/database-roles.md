# Database roles and workspace RLS

## Threat model and boundaries

PostgreSQL row-level security is defense-in-depth against a workspace-scoped
repository accidentally omitting its `workspace_id` predicate. It supplements,
and does not replace, `AccessTokenGuard`, `WorkspaceContextGuard`, membership
authorization, parameterized SQL, or least-privilege role grants.

The API process uses only a non-owner runtime login with `NOBYPASSRLS`. The
migration login owns schema objects and is supplied only to the migration job.
The migration owner intentionally retains PostgreSQL's owner bypass so it can
perform reviewed data/schema maintenance; it must never be used by the API.
`FORCE ROW LEVEL SECURITY` is therefore not enabled. Production verification
must prove the runtime login owns no protected table and has no bypass flag.

## Current protected and bootstrap tables

RLS is enabled on `workspaces`, `workspace_members`, all seven core portfolio
tables, `inventory_nodes`, and `inventory_relationships`. Workspace policies
require their workspace key to equal `domainpulse.current_workspace_id()`.
Membership SELECT additionally permits only rows belonging to
`domainpulse.current_user_id()` when no workspace context is active; this is
the narrow bootstrap path. The helpers return `NULL` for absent, empty, or
malformed settings, so policies fail closed. `USING` protects reads, updates,
and deletes; `WITH CHECK` protects inserts and cross-workspace moves.

`users`, `password_credentials`, and `sessions` remain outside workspace RLS.
Registration, login, refresh, logout, `/auth/me`, and personal-workspace lookup
must operate before an active workspace exists. Their repositories remain
identity/session-scoped and use narrow queries. This avoids making membership
resolution depend on a context that only membership resolution can establish.

For default resolution, transaction-local authenticated-user context locates
`users.personal_workspace_id` and exposes only that user's matching membership.
For an explicit header, the UUID remains only a predicate in that same narrow
user-context membership query. The candidate is never installed as database
workspace context and becomes the request's trusted `WorkspacePrincipal` only
after the membership query succeeds.

## Transaction-local context

`withWorkspaceContext(workspaceId, callback)` validates the UUID, begins a
transaction, calls `set_config('domainpulse.workspace_id', ..., true)`, and
runs the callback on that same transaction. `withUserContext` applies the same
lifecycle to authenticated identity only for membership bootstrap. The third
argument makes each value transaction-local. Commit and rollback both clear it
before a pooled connection can be reused. Persistent `SET` is prohibited.

Registration uses a server-generated workspace UUID with this helper while it
atomically creates the workspace, user, credential, and owner membership. No
HTTP request object, session ID, token, or secret enters the database context.

## Provisioning runbook

Provision roles outside schema migrations. Run the following with `psql` as a
cluster/database administrator after replacing the variables. It contains no
password; configure authentication through the deployment secret manager,
managed identity, or a separate secure command.

```sql
\set runtime_role 'replace_me_runtime_role'
\set database_name 'replace_me_database'

SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
  :'runtime_role'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'runtime_role'
) \gexec

ALTER ROLE :"runtime_role"
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE :"database_name" TO :"runtime_role";
GRANT USAGE ON SCHEMA public, domainpulse TO :"runtime_role";
GRANT EXECUTE ON FUNCTION
  domainpulse.current_workspace_id(), domainpulse.current_user_id()
  TO :"runtime_role";

GRANT SELECT, INSERT ON users, password_credentials TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE ON sessions TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON workspaces, workspace_members
  TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON
  projects,
  email_accounts,
  provider_accounts,
  domains,
  servers,
  cloud_resources,
  website_applications
  TO :"runtime_role";
GRANT SELECT ON inventory_nodes TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_relationships
  TO :"runtime_role";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public, domainpulse FROM :"runtime_role";
```

The API's `DATABASE_URL` must authenticate as that runtime login. The migration
job's separate `MIGRATION_DATABASE_URL` must authenticate as the schema owner.
Never grant the runtime login membership in the migration/owner role.

Verify every deployment without displaying connection credentials:

```sql
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
FROM pg_catalog.pg_roles
WHERE rolname IN ('replace_me_runtime_role', 'replace_me_migration_role');

SELECT schemaname, tablename, tableowner, rowsecurity
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'workspaces',
    'workspace_members',
    'projects',
    'email_accounts',
    'provider_accounts',
    'domains',
    'servers',
    'cloud_resources',
    'website_applications',
    'inventory_nodes',
    'inventory_relationships'
  );
```

The runtime row must have every capability flag shown as false, must not match
any `tableowner`, and every protected table must report RLS enabled.

The runtime role receives SELECT only on `inventory_nodes`; it receives no
direct node INSERT, UPDATE, or DELETE privilege. Migration-owner,
schema-qualified `SECURITY DEFINER` trigger functions maintain nodes after
portfolio entity inserts and deletes. Their search path is fixed and PUBLIC
execution is revoked. The runtime role receives normal DML privileges on
`inventory_relationships`, whose RLS and composite endpoint foreign keys remain
authoritative.

The PostgreSQL RLS suite uses only `RLS_TEST_DATABASE_URL`, which must identify
a dedicated disposable database whose login can create roles. It never falls
back to the ordinary non-privileged `TEST_DATABASE_URL` or runtime
`DATABASE_URL`. When absent, only this suite skips. It creates a temporary
`NOLOGIN NOBYPASSRLS` non-owner role, grants the production-equivalent DML
surface, and executes queries after `SET ROLE`. It proves bidirectional SELECT
isolation, bootstrap membership isolation, cross-workspace
INSERT/UPDATE/DELETE denial, allowed same-workspace writes, missing/invalid
context failure, and context cleanup on commit, rollback, and reuse of the same
physical pooled session. The test role and its grants are removed afterward.

## Future workspace-scoped tables

Every future tenant table must have `workspace_id uuid NOT NULL`, an explicit
foreign key and lookup index, then use the same fail-closed expression. Policies
may be split by operation when permissions differ:

```sql
ALTER TABLE example ENABLE ROW LEVEL SECURITY;
CREATE POLICY example_select ON example FOR SELECT
  USING (workspace_id = domainpulse.current_workspace_id());
CREATE POLICY example_insert ON example FOR INSERT
  WITH CHECK (workspace_id = domainpulse.current_workspace_id());
CREATE POLICY example_update ON example FOR UPDATE
  USING (workspace_id = domainpulse.current_workspace_id())
  WITH CHECK (workspace_id = domainpulse.current_workspace_id());
CREATE POLICY example_delete ON example FOR DELETE
  USING (workspace_id = domainpulse.current_workspace_id());
```

The role-provisioning runbook must grant only each table's required DML
privileges, while migrations remain role-name agnostic. Every protected table
also requires real non-owner cross-tenant tests.
