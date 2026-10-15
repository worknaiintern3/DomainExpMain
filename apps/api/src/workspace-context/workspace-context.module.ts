import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { MongoWorkspaceContextRepository } from './mongo-workspace-context.repository';
import { WorkspaceContextGuard } from './workspace-context.guard';
import { WorkspaceContextService } from './workspace-context.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: MongoWorkspaceContextRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoWorkspaceContextRepository(database),
    },
    {
      provide: WorkspaceContextService,
      inject: [MongoWorkspaceContextRepository],
      useFactory: (repository: MongoWorkspaceContextRepository) =>
        new WorkspaceContextService(repository),
    },
    WorkspaceContextGuard,
  ],
  exports: [WorkspaceContextGuard, WorkspaceContextService],
})
export class WorkspaceContextModule {}
