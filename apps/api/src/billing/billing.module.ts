import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { BillingController } from './billing.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BillingController],
})
export class BillingModule {}
