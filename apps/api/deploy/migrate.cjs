// Uses the production Drizzle migrator; no devDependencies needed in the image.
const { resolve } = require('node:path');
const { readFileSync, readdirSync } = require('node:fs');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { createDatabaseClient, parseDatabaseEnvironment } = require('@domainpulse/database');

let stage = 'configuration';
async function main() {
  if (!process.env.MIGRATION_DATABASE_URL) {
    throw new Error('MIGRATION_DATABASE_URL is required');
  }
  const migrationsFolder = resolve(__dirname, '../../../packages/database/migrations');
  const journal = JSON.parse(readFileSync(resolve(migrationsFolder, 'meta/_journal.json'), 'utf8'));
  const sqlFiles = readdirSync(migrationsFolder).filter(name => name.endsWith('.sql')).sort();
  const journalFiles = journal.entries.map(entry => entry.tag + '.sql').sort();
  if (JSON.stringify(sqlFiles) !== JSON.stringify(journalFiles)) {
    throw new Error('Committed migration SQL and journal disagree');
  }
  const runtimeUrl = new URL(process.env.DATABASE_URL);
  const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
  if (runtimeUrl.hostname !== ownerUrl.hostname || runtimeUrl.port !== ownerUrl.port || runtimeUrl.pathname !== ownerUrl.pathname) {
    throw new Error('Migration and runtime database targets must match');
  }
  const client = createDatabaseClient(parseDatabaseEnvironment({
    ...process.env,
    DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
  }));
  try {
    // Grants are reapplied after each migration so newly created tables work.
    // The runtime role must already exist and must never own the application tables.
    const runtimeRole = decodeURIComponent(runtimeUrl.username);
    if (!runtimeRole) throw new Error('DATABASE_URL must name the runtime role');
    const role = '"' + runtimeRole.replaceAll('"', '""') + '"';
    const { sql } = require('drizzle-orm');
    stage = 'runtime-role validation (DATABASE_URL)';
    const roles = await client.database.execute(sql`
      SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = ${runtimeRole}
    `);
    const record = roles.rows[0];
    if (!record || record.rolsuper || record.rolbypassrls) {
      throw new Error('Runtime database role must exist and have no SUPERUSER/BYPASSRLS');
    }
    const ownership = await client.database.execute(sql`
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tableowner = ${runtimeRole} LIMIT 1
    `);
    if (ownership.rows.length) throw new Error('Runtime database role must not own application tables');
    stage = 'committed migrations (MIGRATION_DATABASE_URL)';
    await migrate(client.database, { migrationsFolder });
    stage = 'runtime role grants';
    await client.database.execute(sql.raw(`
      GRANT USAGE ON SCHEMA public, domainpulse TO ${role};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role};
      GRANT EXECUTE ON FUNCTION domainpulse.current_workspace_id(), domainpulse.current_user_id() TO ${role};
    `));
    console.log('Database migrations and API role grants completed');
  } finally {
    await client.close();
  }
}

main().catch(() => {
  // Driver errors can contain connection credentials/SQL; keep CI output sanitized.
  console.error(`Database migration failed at ${stage}. No schema reset or rollback was attempted.`);
  process.exitCode = 1;
});
