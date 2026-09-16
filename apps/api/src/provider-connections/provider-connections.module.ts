import { parseProviderCredentialEncryptionEnvironment } from '@domainpulse/database';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { CloudflareTokenValidator } from './cloudflare-token-validator';
import { ProviderConnectionsController } from './provider-connections.controller';
import { PostgresProviderConnectionsRepository } from './provider-connections.repository';
import { ProviderConnectionsService } from './provider-connections.service';

@Module({
  controllers: [ProviderConnectionsController],
  imports: [DatabaseModule],
  providers: [
    {
      provide: PostgresProviderConnectionsRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresProviderConnectionsRepository(database),
    },
    {
      provide: CloudflareTokenValidator,
      useFactory: () => new CloudflareTokenValidator(),
    },
    {
      provide: ProviderConnectionsService,
      inject: [PostgresProviderConnectionsRepository, CloudflareTokenValidator],
      useFactory: (
        repository: PostgresProviderConnectionsRepository,
        tokenValidator: CloudflareTokenValidator,
      ) =>
        new ProviderConnectionsService(
          repository,
          parseProviderCredentialEncryptionEnvironment(process.env),
          tokenValidator,
        ),
    },
  ],
  exports: [ProviderConnectionsService],
})
export class ProviderConnectionsModule {}
