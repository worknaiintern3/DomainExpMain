import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MobileClientController } from './mobile-client.controller';
import { MobileClientService } from './mobile-client.service';

@Module({
  imports: [AuthModule],
  controllers: [MobileClientController],
  providers: [MobileClientService],
  exports: [MobileClientService],
})
export class MobileClientModule {}
