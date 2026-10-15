import { describe, expect, it } from 'vitest';

import {
  extractDatabaseNameFromUri,
  parseMongoEnvironment,
  sanitizeMongoConfiguration,
  sanitizeMongoUri,
  MongoConfigurationError,
} from '../src/mongo';

describe('MongoDB Configuration & URI Handling', () => {
  it('extracts database name from standard Atlas URI', () => {
    const uri =
      'mongodb+srv://user:pass@cluster0.pfcb78g.mongodb.net/domainpulse_prod?retryWrites=true&w=majority';
    expect(extractDatabaseNameFromUri(uri)).toBe('domainpulse_prod');
  });

  it('uses explicit database name when provided', () => {
    const uri =
      'mongodb+srv://user:pass@cluster0.pfcb78g.mongodb.net/?retryWrites=true&w=majority';
    expect(extractDatabaseNameFromUri(uri, 'custom_db')).toBe('custom_db');
  });

  it('falls back to domainpulse if no database name in URI', () => {
    const uri = 'mongodb+srv://user:pass@cluster0.pfcb78g.mongodb.net/';
    expect(extractDatabaseNameFromUri(uri)).toBe('domainpulse');
  });

  it('sanitizes credentials from URI strings without leaking password', () => {
    const uri =
      'mongodb+srv://worknaiintern3_db_user:SecretP%40ssw0rd!@cluster0.pfcb78g.mongodb.net/domainpulse?retryWrites=true';
    const sanitized = sanitizeMongoUri(uri);
    expect(sanitized).toBe(
      'mongodb+srv://***:***@cluster0.pfcb78g.mongodb.net/domainpulse?retryWrites=true',
    );
    expect(sanitized).not.toContain('SecretP');
    expect(sanitized).not.toContain('worknaiintern3_db_user');
  });

  it('parses valid environment variables and applies defaults', () => {
    const config = parseMongoEnvironment({
      MONGODB_URI:
        'mongodb+srv://worknaiintern3_db_user:password123@cluster0.pfcb78g.mongodb.net/my_database?retryWrites=true&w=majority',
    });

    expect(config.databaseName).toBe('my_database');
    expect(config.pool.maxPoolSize).toBe(20);
    expect(config.pool.minPoolSize).toBe(2);
    expect(config.pool.connectTimeoutMS).toBe(10000);

    const sanitized = sanitizeMongoConfiguration(config);
    expect(sanitized.uri).not.toContain('password123');
    expect(sanitized.uri).toContain('***:***');
  });

  it('throws MongoConfigurationError on invalid URI', () => {
    expect(() =>
      parseMongoEnvironment({
        MONGODB_URI: 'postgresql://user:pass@localhost:5432/db',
      }),
    ).toThrow(MongoConfigurationError);
  });
});
