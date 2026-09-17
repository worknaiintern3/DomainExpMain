import { parseProviderCredentialEncryptionEnvironment } from '@domainpulse/database';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { AwsCredentialValidator } from './aws-credential-validator';
import { AzureCredentialValidator } from './azure-credential-validator';
import { CloudflareTokenValidator } from './cloudflare-token-validator';
import { DigitalOceanTokenValidator } from './digitalocean-token-validator';
import { GcpCredentialValidator } from './gcp-credential-validator';
import { GoDaddyTokenValidator } from './godaddy-token-validator';
import { HetznerTokenValidator } from './hetzner-token-validator';
import { HostingerTokenValidator } from './hostinger-token-validator';
import { LinodeTokenValidator } from './linode-token-validator';
import { NamecheapTokenValidator } from './namecheap-token-validator';
import { VultrTokenValidator } from './vultr-token-validator';
import { ProviderConnectionsController } from './provider-connections.controller';
import { PostgresProviderConnectionsRepository } from './provider-connections.repository';
import { ProviderConnectionsService } from './provider-connections.service';
import type { ProviderConnectionAuthType } from './provider-connections.types';
import type {
  ProviderCredentialValidator,
  ProviderCredentialValidatorRegistry,
} from './provider-credential-validator';

const PROVIDER_CREDENTIAL_VALIDATOR_REGISTRY = Symbol('PROVIDER_CREDENTIAL_VALIDATOR_REGISTRY');

@Module({
  controllers: [ProviderConnectionsController],
  imports: [DatabaseModule],
  providers: [
    {
      provide: PostgresProviderConnectionsRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresProviderConnectionsRepository(database),
    },
    {
      provide: PROVIDER_CREDENTIAL_VALIDATOR_REGISTRY,
      useFactory: (): ProviderCredentialValidatorRegistry =>
        new Map<ProviderConnectionAuthType, ProviderCredentialValidator>([
          ['CLOUDFLARE_API_TOKEN', new CloudflareTokenValidator()],
          ['GODADDY_PAT', new GoDaddyTokenValidator()],
          ['NAMECHEAP_API_KEY', new NamecheapTokenValidator()],
          ['HOSTINGER_API_TOKEN', new HostingerTokenValidator()],
          ['DIGITALOCEAN_API_TOKEN', new DigitalOceanTokenValidator()],
          ['HETZNER_API_TOKEN', new HetznerTokenValidator()],
          ['VULTR_API_KEY', new VultrTokenValidator()],
          ['LINODE_API_TOKEN', new LinodeTokenValidator()],
          ['AWS_ACCESS_KEY', new AwsCredentialValidator()],
          ['GCP_SERVICE_ACCOUNT_KEY', new GcpCredentialValidator()],
          ['AZURE_CLIENT_CREDENTIALS', new AzureCredentialValidator()],
        ]),
    },
    {
      provide: ProviderConnectionsService,
      inject: [PostgresProviderConnectionsRepository, PROVIDER_CREDENTIAL_VALIDATOR_REGISTRY],
      useFactory: (
        repository: PostgresProviderConnectionsRepository,
        validators: ProviderCredentialValidatorRegistry,
      ) =>
        new ProviderConnectionsService(
          repository,
          parseProviderCredentialEncryptionEnvironment(process.env),
          validators,
        ),
    },
  ],
  exports: [ProviderConnectionsService],
})
export class ProviderConnectionsModule {}
