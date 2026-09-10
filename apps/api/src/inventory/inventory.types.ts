import type {
  CreateApplicationRequest,
  CreateCloudResourceRequest,
  CreateDomainRequest,
  CreateEmailAccountRequest,
  CreateProjectRequest,
  CreateProviderAccountRequest,
  CreateServerRequest,
  InventoryListQuery,
  UpdateApplicationRequest,
  UpdateCloudResourceRequest,
  UpdateDomainRequest,
  UpdateEmailAccountRequest,
  UpdateProjectRequest,
  UpdateProviderAccountRequest,
  UpdateServerRequest,
} from '@domainpulse/contracts';
import type {
  CloudResource,
  DatabaseTransactionOperation,
  Domain,
  EmailAccount,
  Project,
  ProviderAccount,
  Server,
  WebsiteApplication,
} from '@domainpulse/database';

import type { WorkspacePrincipal } from '../workspace-context';

export type InventoryResourceKind =
  | 'email-account'
  | 'provider-account'
  | 'project'
  | 'domain'
  | 'server'
  | 'cloud-resource'
  | 'application';

export type CreateInventoryCommand =
  | { readonly resource: 'email-account'; readonly input: CreateEmailAccountRequest }
  | {
      readonly resource: 'provider-account';
      readonly input: CreateProviderAccountRequest;
    }
  | { readonly resource: 'project'; readonly input: CreateProjectRequest }
  | { readonly resource: 'domain'; readonly input: CreateDomainRequest }
  | { readonly resource: 'server'; readonly input: CreateServerRequest }
  | {
      readonly resource: 'cloud-resource';
      readonly input: CreateCloudResourceRequest;
    }
  | { readonly resource: 'application'; readonly input: CreateApplicationRequest };

export type UpdateInventoryCommand =
  | { readonly resource: 'email-account'; readonly input: UpdateEmailAccountRequest }
  | {
      readonly resource: 'provider-account';
      readonly input: UpdateProviderAccountRequest;
    }
  | { readonly resource: 'project'; readonly input: UpdateProjectRequest }
  | { readonly resource: 'domain'; readonly input: UpdateDomainRequest }
  | { readonly resource: 'server'; readonly input: UpdateServerRequest }
  | {
      readonly resource: 'cloud-resource';
      readonly input: UpdateCloudResourceRequest;
    }
  | { readonly resource: 'application'; readonly input: UpdateApplicationRequest };

export type InventoryRecordEnvelope =
  | { readonly resource: 'email-account'; readonly record: EmailAccount }
  | { readonly resource: 'provider-account'; readonly record: ProviderAccount }
  | { readonly resource: 'project'; readonly record: Project }
  | { readonly resource: 'domain'; readonly record: Domain }
  | { readonly resource: 'server'; readonly record: Server }
  | { readonly resource: 'cloud-resource'; readonly record: CloudResource }
  | { readonly resource: 'application'; readonly record: WebsiteApplication };

export interface InventoryCursorPosition {
  readonly createdAt: string;
  readonly id: string;
}

export interface InventoryStoreListInput {
  readonly cursor?: InventoryCursorPosition;
  readonly includeArchived: boolean;
  readonly limit: number;
}

export interface InventoryStorePage {
  readonly items: readonly InventoryRecordEnvelope[];
  readonly nextCursor: InventoryCursorPosition | null;
}

type EmailAccountCreateValues = Pick<
  EmailAccount,
  'email' | 'label' | 'normalizedEmail' | 'notes'
>;
type ProviderAccountCreateValues = Pick<
  ProviderAccount,
  | 'externalAccountId'
  | 'label'
  | 'loginEmailAccountId'
  | 'notes'
  | 'providerKey'
>;
type ProjectCreateValues = Pick<
  Project,
  'description' | 'name' | 'normalizedName'
>;
type DomainCreateValues = Pick<
  Domain,
  | 'autoRenew'
  | 'dnsProviderAccountId'
  | 'domainName'
  | 'expiresAt'
  | 'normalizedDomainName'
  | 'notes'
  | 'registeredAt'
  | 'registrarProviderAccountId'
>;
type ServerCreateValues = Pick<
  Server,
  | 'hostname'
  | 'name'
  | 'notes'
  | 'operatingSystem'
  | 'primaryIp'
  | 'providerAccountId'
  | 'region'
  | 'serverKind'
>;
type CloudResourceCreateValues = Pick<
  CloudResource,
  | 'externalResourceId'
  | 'name'
  | 'notes'
  | 'providerAccountId'
  | 'region'
  | 'resourceType'
>;
type ApplicationCreateValues = Pick<
  WebsiteApplication,
  | 'kind'
  | 'name'
  | 'notes'
  | 'primaryDomainId'
  | 'primaryUrl'
  | 'projectId'
>;

export type PersistInventoryCreateCommand =
  | { readonly resource: 'email-account'; readonly values: EmailAccountCreateValues }
  | {
      readonly resource: 'provider-account';
      readonly values: ProviderAccountCreateValues;
    }
  | { readonly resource: 'project'; readonly values: ProjectCreateValues }
  | { readonly resource: 'domain'; readonly values: DomainCreateValues }
  | { readonly resource: 'server'; readonly values: ServerCreateValues }
  | {
      readonly resource: 'cloud-resource';
      readonly values: CloudResourceCreateValues;
    }
  | { readonly resource: 'application'; readonly values: ApplicationCreateValues };

export type PersistInventoryUpdateCommand =
  | {
      readonly resource: 'email-account';
      readonly values: Partial<EmailAccountCreateValues> &
        Partial<Pick<EmailAccount, 'inventoryState'>> &
        Pick<EmailAccount, 'updatedAt'>;
    }
  | {
      readonly resource: 'provider-account';
      readonly values: Partial<ProviderAccountCreateValues> &
        Partial<Pick<ProviderAccount, 'inventoryState'>> &
        Pick<ProviderAccount, 'updatedAt'>;
    }
  | {
      readonly resource: 'project';
      readonly values: Partial<ProjectCreateValues> &
        Partial<Pick<Project, 'inventoryState'>> & Pick<Project, 'updatedAt'>;
    }
  | {
      readonly resource: 'domain';
      readonly values: Partial<DomainCreateValues> &
        Partial<Pick<Domain, 'inventoryState'>> & Pick<Domain, 'updatedAt'>;
    }
  | {
      readonly resource: 'server';
      readonly values: Partial<ServerCreateValues> &
        Partial<Pick<Server, 'inventoryState'>> & Pick<Server, 'updatedAt'>;
    }
  | {
      readonly resource: 'cloud-resource';
      readonly values: Partial<CloudResourceCreateValues> &
        Partial<Pick<CloudResource, 'inventoryState'>> &
        Pick<CloudResource, 'updatedAt'>;
    }
  | {
      readonly resource: 'application';
      readonly values: Partial<ApplicationCreateValues> &
        Partial<Pick<WebsiteApplication, 'inventoryState'>> &
        Pick<WebsiteApplication, 'updatedAt'>;
    };

export interface InventoryStore {
  archive(
    workspaceId: string,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<boolean>;
  create(
    workspaceId: string,
    command: PersistInventoryCreateCommand,
  ): Promise<InventoryRecordEnvelope>;
  findById(
    workspaceId: string,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<InventoryRecordEnvelope | undefined>;
  list(
    workspaceId: string,
    resource: InventoryResourceKind,
    input: InventoryStoreListInput,
  ): Promise<InventoryStorePage>;
  update(
    workspaceId: string,
    id: string,
    command: PersistInventoryUpdateCommand,
  ): Promise<InventoryRecordEnvelope | undefined>;
}

export interface InventoryServicePage {
  readonly items: readonly InventoryRecordEnvelope[];
  readonly nextCursor: string | null;
}

export interface InventoryApplicationService {
  archive(
    principal: WorkspacePrincipal,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<void>;
  create(
    principal: WorkspacePrincipal,
    command: CreateInventoryCommand,
  ): Promise<InventoryRecordEnvelope>;
  get(
    principal: WorkspacePrincipal,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<InventoryRecordEnvelope>;
  list(
    principal: WorkspacePrincipal,
    resource: InventoryResourceKind,
    query: InventoryListQuery,
  ): Promise<InventoryServicePage>;
  update(
    principal: WorkspacePrincipal,
    id: string,
    command: UpdateInventoryCommand,
  ): Promise<InventoryRecordEnvelope>;
}

export interface InventoryDatabaseHost {
  withWorkspaceContext<T>(
    workspaceId: string,
    operation: DatabaseTransactionOperation<T>,
  ): Promise<T>;
}
