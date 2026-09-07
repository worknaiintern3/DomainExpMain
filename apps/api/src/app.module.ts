import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { ProblemDetailsFilter } from './common/http/problem-details.filter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ReadinessModule } from './readiness/readiness.module';

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, ReadinessModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter,
    },
  ],
})
export class AppModule {}
