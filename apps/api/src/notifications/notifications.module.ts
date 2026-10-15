import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { PushSenderService } from './push-sender.service';
import { ExpiryMonitorService } from './expiry-monitor.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspaceContextModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: NotificationsRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new NotificationsRepository(database),
    },
    {
      provide: PushSenderService,
      inject: [NotificationsRepository],
      useFactory: (repository: NotificationsRepository) =>
        new PushSenderService(repository),
    },
    {
      provide: ExpiryMonitorService,
      inject: [DatabaseService, NotificationsRepository, PushSenderService],
      useFactory: (
        database: DatabaseService,
        repository: NotificationsRepository,
        pushSender: PushSenderService,
      ) => new ExpiryMonitorService(database, repository, pushSender),
    },
  ],
  exports: [NotificationsRepository, PushSenderService, ExpiryMonitorService],
})
export class NotificationsModule {}
