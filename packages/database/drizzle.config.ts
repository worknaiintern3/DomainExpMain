import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

import { parseDatabaseUrl } from './src/config/database-env.schema';

const rootEnvPath = resolve(__dirname, '../../.env');
if (typeof process.loadEnvFile === 'function' && existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

const migrationDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

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

