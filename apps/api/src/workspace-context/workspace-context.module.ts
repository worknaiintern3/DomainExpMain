import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { WorkspaceContextGuard } from './workspace-context.guard';
import { PostgresWorkspaceContextRepository } from './workspace-context.repository';
import { WorkspaceContextService } from './workspace-context.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: PostgresWorkspaceContextRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresWorkspaceContextRepository(database),
    },
    {
      provide: WorkspaceContextService,
      inject: [PostgresWorkspaceContextRepository],
      useFactory: (repository: PostgresWorkspaceContextRepository) =>
        new WorkspaceContextService(repository),
    },
    WorkspaceContextGuard,
  ],
  exports: [WorkspaceContextGuard, WorkspaceContextService],
})
export class WorkspaceContextModule {}
