import { Module } from '@nestjs/common';

import { MobileClientController } from './mobile-client.controller';
import { MobileClientService } from './mobile-client.service';

@Module({
  controllers: [MobileClientController],
  providers: [MobileClientService],
  exports: [MobileClientService],
})
export class MobileClientModule {}
