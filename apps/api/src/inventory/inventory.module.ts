import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module';
import { ApplicationsController } from './applications/applications.controller';
import { CloudResourcesController } from './cloud-resources/cloud-resources.controller';
import { DomainsController } from './domains/domains.controller';
import { EmailAccountsController } from './email-accounts/email-accounts.controller';
import { InventoryService } from './inventory.service';
import { PostgresInventoryRepository } from './inventory.repository';
import { ProjectsController } from './projects/projects.controller';
import { ProviderAccountsController } from './provider-accounts/provider-accounts.controller';
import { InventoryRelationshipsController } from './relationships/relationships.controller';
import { PostgresInventoryRelationshipRepository } from './relationships/relationships.repository';
import { InventoryRelationshipService } from './relationships/relationships.service';
import { ServersController } from './servers/servers.controller';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspaceContextModule],
  controllers: [
    EmailAccountsController,
    ProviderAccountsController,
    ProjectsController,
    DomainsController,
    ServersController,
    CloudResourcesController,
    ApplicationsController,
    InventoryRelationshipsController,
  ],
  providers: [
    {
      provide: PostgresInventoryRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresInventoryRepository(database),
    },
    {
      provide: InventoryService,
      inject: [PostgresInventoryRepository],
      useFactory: (repository: PostgresInventoryRepository) =>
        new InventoryService(repository),
    },
    {
      provide: PostgresInventoryRelationshipRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresInventoryRelationshipRepository(database),
    },
    {
      provide: InventoryRelationshipService,
      inject: [PostgresInventoryRelationshipRepository],
      useFactory: (repository: PostgresInventoryRelationshipRepository) =>
        new InventoryRelationshipService(repository),
    },
  ],
})
export class InventoryModule {}
