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
  ],
})
export class InventoryModule {}
