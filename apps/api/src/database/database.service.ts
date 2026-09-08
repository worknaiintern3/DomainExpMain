import {
  createDatabaseClient,
  parseDatabaseEnvironment,
  type Database,
  type DatabaseClient,
  type DatabaseTransactionOperation,
} from '@domainpulse/database';
import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly client: DatabaseClient;

  constructor() {
    const configuration = parseDatabaseEnvironment(process.env);
    this.client = createDatabaseClient(configuration, {
      onPoolError: (event) => {
        this.logger.error(JSON.stringify(event));
      },
    });
  }

  get database(): Database {
    return this.client.database;
  }

  ping(): Promise<void> {
    return this.client.ping();
  }

  transaction<T>(operation: DatabaseTransactionOperation<T>): Promise<T> {
    return this.client.transaction(operation);
  }

  withUserContext<T>(
    userId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T> {
    return this.client.withUserContext(userId, operation);
  }

  withWorkspaceContext<T>(
    workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T> {
    return this.client.withWorkspaceContext(workspaceId, operation);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
