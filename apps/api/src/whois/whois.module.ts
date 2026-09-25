import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module';
import { WhoisController } from './whois.controller';
import { WhoisService } from './whois.service';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspaceContextModule],
  controllers: [WhoisController],
  providers: [
    {
      provide: WhoisService,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) => new WhoisService(db),
    },
  ],
  exports: [WhoisService],
})
export class WhoisModule {}
