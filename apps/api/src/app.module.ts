import { Module } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './auth/auth.module';
import { ProblemDetailsFilter } from './common/http/problem-details.filter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { MetadataModule } from './metadata/metadata.module';
import { MobileAdminModule } from './mobile-admin/mobile-admin.module';
import { MobileClientModule } from './mobile-client/mobile-client.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProviderConnectionsModule } from './provider-connections/provider-connections.module';
import { ReadinessModule } from './readiness/readiness.module';
import { WhoisModule } from './whois/whois.module';
import { GooglePlayModule } from './google-play/google-play.module';
import { PrivacyModule } from './privacy/privacy.module';
import { PlayStoreModule } from './play-store/play-store.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    ReadinessModule,
    InventoryModule,
    MetadataModule,
    MonitoringModule,
    NotificationsModule,
    ProviderConnectionsModule,
    MobileClientModule,
    MobileAdminModule,
    WhoisModule,
    GooglePlayModule,
    PrivacyModule,
    PlayStoreModule,
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
