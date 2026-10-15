import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { GooglePlayClientService } from './google-play-client.service';
import { GooglePlayCryptoService } from './google-play-crypto.service';
import { GooglePlayController } from './google-play.controller';
import { GooglePlayRepository } from './google-play.repository';
import { GooglePlayService } from './google-play.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [GooglePlayController],
  providers: [
    GooglePlayRepository,
    GooglePlayCryptoService,
    GooglePlayClientService,
    GooglePlayService,
  ],
  exports: [GooglePlayService],
})
export class GooglePlayModule {}
