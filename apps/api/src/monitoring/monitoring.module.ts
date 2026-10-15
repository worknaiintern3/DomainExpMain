import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module';
import {
  AlertRulesController,
  AlertsController,
  MonitoringController,
} from './monitoring.controller';
import { MongoMonitoringRepository } from './monitoring.repository';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspaceContextModule],
  controllers: [MonitoringController, AlertsController, AlertRulesController],
  providers: [
    {
      provide: MongoMonitoringRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoMonitoringRepository(database),
    },
    {
      provide: MonitoringService,
      inject: [MongoMonitoringRepository],
      useFactory: (repository: MongoMonitoringRepository) =>
        new MonitoringService(repository),
    },
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}