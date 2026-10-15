import { Module } from '@nestjs/common';
import { PlayStoreController } from './play-store.controller';
import { PlayStoreService } from './play-store.service';

@Module({
  controllers: [PlayStoreController],
  providers: [PlayStoreService],
  exports: [PlayStoreService],
})
export class PlayStoreModule {}
