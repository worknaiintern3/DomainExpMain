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
import { PostgresMonitoringRepository } from './monitoring.repository';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspaceContextModule],
  controllers: [MonitoringController, AlertsController, AlertRulesController],
  providers: [
    {
      provide: PostgresMonitoringRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresMonitoringRepository(database),
    },
    {
      provide: MonitoringService,
      inject: [PostgresMonitoringRepository],
      useFactory: (repository: PostgresMonitoringRepository) =>
        new MonitoringService(repository),
    },
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}