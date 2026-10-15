import {
  createMongoDatabaseClient,
  ensureMongoIndexes,
  getMongoCollections,
  mongoose,
  parseMongoEnvironment,
  sanitizeMongoUri,
  type DatabaseTransactionOperation,
  type MongoCollections,
  type MongoDatabaseClient,
} from '@domainpulse/database';
import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import type { Db } from 'mongodb';

@Injectable()
export class DatabaseService implements OnApplicationShutdown, OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly _mongoClient: MongoDatabaseClient;
  private readonly _databaseName: string;
  private readonly _uri: string;

  constructor() {
    try {
      const mongoConfig = parseMongoEnvironment(process.env);
      this._databaseName = mongoConfig.databaseName;
      this._uri = mongoConfig.uri;

      this._mongoClient = createMongoDatabaseClient(mongoConfig, {
        onConnectionError: (err) => {
          this.logger.error(`MongoDB connection error: ${err.message}`);
        },
        onConnected: () => {
          this.logger.log(`MongoDB connected to database: ${mongoConfig.databaseName}`);
        },
      });

      this.logger.log(
        `Configured MongoDB/Mongoose connection for database: ${mongoConfig.databaseName} (${sanitizeMongoUri(mongoConfig.uri)})`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to configure MongoDB: ${err?.message || String(err)}`);
      throw err;
    }
  }

  get isMongo(): boolean {
    return true;
  }

  get mongoose(): typeof mongoose {
    return mongoose;
  }

  get connection(): typeof mongoose.connection {
    return mongoose.connection;
  }

  get mongoClient(): MongoDatabaseClient {
    return this._mongoClient;
  }

  get mongoDb(): Db {
    return (mongoose.connection.db as Db) || this._mongoClient.db;
  }

  get collections(): MongoCollections {
    return getMongoCollections(this.mongoDb);
  }

  /**
   * Alias for backward compatibility if any legacy consumer queries .database
   */
  get database(): never {
    throw new Error(
      'PostgreSQL is completely removed from this project. All operations run directly on MongoDB / Mongoose.',
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      // Connect Mongoose directly if not already connected
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(this._uri, {
          dbName: this._databaseName,
        });
        this.logger.log(`Mongoose connected successfully to ${this._databaseName}`);
      }

      await this._mongoClient.ping();
      await ensureMongoIndexes(this.mongoDb);
      this.logger.log('MongoDB connection verified and collections/indexes initialized');
    } catch (err: any) {
      this.logger.warn(`MongoDB initial ping/index check notice: ${err?.message || String(err)}`);
    }
  }

  async ping(): Promise<void> {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.command({ ping: 1 });
      return;
    }
    return this._mongoClient.ping();
  }

  transaction<T>(operation: DatabaseTransactionOperation<T>): Promise<T> {
    return this._mongoClient.withTransaction(async () => operation(this as any));
  }

  withUserContext<T>(
    _userId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T> {
    return operation(this as any);
  }

  withWorkspaceContext<T>(
    _workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T> {
    return operation(this as any);
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      await this._mongoClient.close();
      this.logger.log('MongoDB / Mongoose connections cleanly closed');
    } catch (err: any) {
      this.logger.error(`Error closing MongoDB connections: ${err?.message || String(err)}`);
    }
  }
}
