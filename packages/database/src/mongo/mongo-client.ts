import { MongoClient, type ClientSession, type Db } from 'mongodb';

import {
  sanitizeMongoUri,
  type MongoConfiguration,
} from '../config/mongo-env.schema';

export class MongoDatabaseUnavailableError extends Error {
  constructor(message = 'MongoDB is unavailable') {
    super(message);
    this.name = 'MongoDatabaseUnavailableError';
  }
}

export interface CreateMongoDatabaseClientOptions {
  readonly onConnectionError?: (error: Error) => void;
  readonly onConnected?: () => void;
}

export interface MongoDatabaseClient {
  readonly client: MongoClient;
  readonly db: Db;
  readonly databaseName: string;
  ping(): Promise<void>;
  close(): Promise<void>;
  withTransaction<T>(
    operation: (session?: ClientSession) => Promise<T>,
  ): Promise<T>;
}

export function createMongoDatabaseClient(
  configuration: MongoConfiguration,
  options: CreateMongoDatabaseClientOptions = {},
): MongoDatabaseClient {
  const client = new MongoClient(configuration.uri, {
    maxPoolSize: configuration.pool.maxPoolSize,
    minPoolSize: configuration.pool.minPoolSize,
    connectTimeoutMS: configuration.pool.connectTimeoutMS,
    serverSelectionTimeoutMS: configuration.pool.serverSelectionTimeoutMS,
  });

  const db = client.db(configuration.databaseName);
  let closed = false;
  let isConnected = false;

  client.on('error', (err) => {
    // Sanitize any potential sensitive information in error messages
    const sanitizedMsg = err?.message
      ? err.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/g, (match) =>
          sanitizeMongoUri(match),
        )
      : 'Unknown MongoDB error';
    const sanitizedError = new Error(sanitizedMsg);
    options.onConnectionError?.(sanitizedError);
  });

  return {
    client,
    db,
    databaseName: configuration.databaseName,

    async ping(): Promise<void> {
      if (closed) {
        throw new MongoDatabaseUnavailableError('MongoDB connection is closed');
      }

      try {
        if (!isConnected) {
          await client.connect();
          isConnected = true;
          options.onConnected?.();
        }
        await db.command({ ping: 1 });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const sanitized = errorMsg.replace(/mongodb(\+srv)?:\/\/[^\s]+/g, (m) =>
          sanitizeMongoUri(m),
        );
        throw new MongoDatabaseUnavailableError(`MongoDB ping failed: ${sanitized}`);
      }
    },

    async withTransaction<T>(
      operation: (session?: ClientSession) => Promise<T>,
    ): Promise<T> {
      if (closed) {
        throw new MongoDatabaseUnavailableError('MongoDB connection is closed');
      }

      if (!isConnected) {
        await client.connect();
        isConnected = true;
      }

      const session = client.startSession();
      try {
        let result: T;
        try {
          await session.withTransaction(async () => {
            result = await operation(session);
          });
          return result!;
        } catch (txError: any) {
          // If transactions are not supported (e.g. standalone Mongo instance without replica set),
          // fall back to direct execution without transaction
          if (
            txError?.message?.includes('Transaction numbers are only allowed') ||
            txError?.message?.includes('standalone')
          ) {
            return await operation(undefined);
          }
          throw txError;
        }
      } finally {
        await session.endSession();
      }
    },

    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      isConnected = false;
      await client.close();
    },
  };
}
