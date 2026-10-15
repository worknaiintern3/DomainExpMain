import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module';
import { DnsClient } from './dns/dns.client';
import { MetadataController } from './metadata.controller';
import { MongoMetadataRepository } from './metadata.repository';
import { MetadataService } from './metadata.service';
import { RdapClient } from './rdap/rdap.client';
import { TlsClient } from './tls/tls.client';

@Module({
  imports: [AuthModule, DatabaseModule, WorkspaceContextModule],
  controllers: [MetadataController],
  providers: [
    { provide: RdapClient, useFactory: () => new RdapClient() },
    { provide: DnsClient, useFactory: () => new DnsClient() },
    { provide: TlsClient, useFactory: () => new TlsClient() },
    {
      provide: MongoMetadataRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoMetadataRepository(database),
    },
    {
      provide: MetadataService,
      inject: [MongoMetadataRepository, RdapClient, DnsClient, TlsClient],
      useFactory: (
        repository: MongoMetadataRepository,
        rdapClient: RdapClient,
        dnsClient: DnsClient,
        tlsClient: TlsClient,
      ) => new MetadataService(repository, rdapClient, dnsClient, tlsClient),
    },
  ],
})
export class MetadataModule {}
