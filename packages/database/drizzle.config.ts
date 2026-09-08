import { defineConfig } from 'drizzle-kit';

import { parseDatabaseUrl } from './src/config/database-env.schema';

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  casing: 'snake_case',
  strict: true,
  verbose: true,
  ...(migrationDatabaseUrl
    ? {
        dbCredentials: {
          url: parseDatabaseUrl(
            migrationDatabaseUrl,
            'MIGRATION_DATABASE_URL',
          ),
        },
      }
    : {}),
});
