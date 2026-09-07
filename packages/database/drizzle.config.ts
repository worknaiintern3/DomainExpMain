import { defineConfig } from 'drizzle-kit';

import { parseDatabaseUrl } from './src/config/database-env.schema';

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  casing: 'snake_case',
  strict: true,
  verbose: true,
  ...(databaseUrl
    ? { dbCredentials: { url: parseDatabaseUrl(databaseUrl) } }
    : {}),
});
