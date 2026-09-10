import { Module } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { ProblemDetailsFilter } from './common/http/problem-details.filter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReadinessModule } from './readiness/readiness.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    ReadinessModule,
    InventoryModule,
  ],
  providers: [
    {
      // Explicit injection: the dev runtime (tsx watch) does not emit
      // decorator parameter metadata, so useClass would construct the
      // filter with an undefined HttpAdapterHost and crash every handled
      // error into a 500. Matches the inject + useFactory convention used
      // by the other constructor-dependent providers in this repository.
      provide: APP_FILTER,
      inject: [HttpAdapterHost],
      useFactory: (adapterHost: HttpAdapterHost) =>
        new ProblemDetailsFilter(adapterHost),
    },
  ],
})
export class AppModule {}
