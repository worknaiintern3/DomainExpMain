import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { ProblemDetailsFilter } from './common/http/problem-details.filter';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule, HealthModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter,
    },
  ],
})
export class AppModule {}
