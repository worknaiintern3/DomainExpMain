import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module';
import { PlayStoreController } from './play-store.controller';
import { PlayStoreService } from './play-store.service';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspaceContextModule],
  controllers: [PlayStoreController],
  providers: [PlayStoreService],
  exports: [PlayStoreService],
})
export class PlayStoreModule {}

