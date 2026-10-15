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
import { MongoInventoryRepository } from './inventory.repository';
import { ProjectsController } from './projects/projects.controller';
import { ProviderAccountsController } from './provider-accounts/provider-accounts.controller';
import { InventoryReadModelsController } from './read-models/inventory-read-models.controller';
import { MongoInventoryReadModelRepository } from './read-models/inventory-read-models.repository';
import { InventoryReadModelService } from './read-models/inventory-read-models.service';
import { InventoryRelationshipsController } from './relationships/relationships.controller';
import { MongoInventoryRelationshipRepository } from './relationships/relationships.repository';
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
    InventoryReadModelsController,
  ],
  providers: [
    {
      provide: MongoInventoryRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoInventoryRepository(database),
    },
    {
      provide: InventoryService,
      inject: [MongoInventoryRepository],
      useFactory: (repository: MongoInventoryRepository) =>
        new InventoryService(repository),
    },
    {
      provide: MongoInventoryRelationshipRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoInventoryRelationshipRepository(database),
    },
    {
      provide: InventoryRelationshipService,
      inject: [MongoInventoryRelationshipRepository],
      useFactory: (repository: MongoInventoryRelationshipRepository) =>
        new InventoryRelationshipService(repository),
    },
    {
      provide: MongoInventoryReadModelRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoInventoryReadModelRepository(database),
    },
    {
      provide: InventoryReadModelService,
      inject: [MongoInventoryReadModelRepository],
      useFactory: (repository: MongoInventoryReadModelRepository) =>
        new InventoryReadModelService(repository),
    },
  ],
})
export class InventoryModule {}
