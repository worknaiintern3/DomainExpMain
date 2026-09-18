import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  AccessTokenService,
  parseAccessTokenEnvironment,
} from './access-token';
import { AccountService, PostgresPasswordCredentialRepository } from './account';
import { AuthController, AccessTokenGuard } from './http';
import { IdentityService, PostgresIdentityRepository } from './identity';
import { LoginService, PostgresLoginRepository } from './login';
import {
  GoogleIdTokenVerifier,
  GoogleOAuthService,
  GoogleTokenExchangeClient,
  PostgresOAuthIdentityRepository,
  PostgresOAuthTransactionRepository,
  parseGoogleOAuthEnvironment,
} from './oauth';
import {
  PostgresRegistrationRepository,
  RegistrationService,
} from './registration';
import { AuthenticationService } from './runtime';
import {
  LogoutService,
  PostgresSessionRepository,
  RefreshTokenService,
} from './session';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AccessTokenService,
      useFactory: () =>
        new AccessTokenService(parseAccessTokenEnvironment(process.env)),
    },
    {
      provide: PostgresRegistrationRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresRegistrationRepository(database),
    },
    {
      provide: RegistrationService,
      inject: [PostgresRegistrationRepository],
      useFactory: (repository: PostgresRegistrationRepository) =>
        new RegistrationService(repository),
    },
    {
      provide: PostgresLoginRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresLoginRepository(database),
    },
    {
      provide: LoginService,
      inject: [PostgresLoginRepository],
      useFactory: (repository: PostgresLoginRepository) =>
        new LoginService(repository),
    },
    {
      provide: PostgresSessionRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresSessionRepository(database),
    },
    {
      provide: RefreshTokenService,
      inject: [PostgresSessionRepository, AccessTokenService],
      useFactory: (
        repository: PostgresSessionRepository,
        accessTokenService: AccessTokenService,
      ) => new RefreshTokenService(repository, accessTokenService),
    },
    {
      provide: LogoutService,
      inject: [PostgresSessionRepository],
      useFactory: (repository: PostgresSessionRepository) =>
        new LogoutService(repository),
    },
    {
      provide: PostgresIdentityRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresIdentityRepository(database),
    },
    {
      provide: IdentityService,
      inject: [PostgresIdentityRepository],
      useFactory: (repository: PostgresIdentityRepository) =>
        new IdentityService(repository),
    },
    {
      provide: AuthenticationService,
      inject: [LoginService, AccessTokenService, RefreshTokenService],
      useFactory: (
        loginService: LoginService,
        accessTokenService: AccessTokenService,
        refreshTokenService: RefreshTokenService,
      ) =>
        new AuthenticationService(
          loginService,
          accessTokenService,
          refreshTokenService,
        ),
    },
    {
      provide: PostgresOAuthTransactionRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresOAuthTransactionRepository(database),
    },
    {
      provide: PostgresOAuthIdentityRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresOAuthIdentityRepository(database),
    },
    {
      provide: GoogleTokenExchangeClient,
      useFactory: () => new GoogleTokenExchangeClient(),
    },
    {
      provide: GoogleIdTokenVerifier,
      useFactory: () => new GoogleIdTokenVerifier(),
    },
    {
      provide: GoogleOAuthService,
      inject: [
        PostgresOAuthTransactionRepository,
        PostgresOAuthIdentityRepository,
        GoogleTokenExchangeClient,
        GoogleIdTokenVerifier,
        PostgresLoginRepository,
        AccessTokenService,
      ],
      useFactory: (
        transactionStore: PostgresOAuthTransactionRepository,
        identityStore: PostgresOAuthIdentityRepository,
        tokenExchangeClient: GoogleTokenExchangeClient,
        idTokenVerifier: GoogleIdTokenVerifier,
        // Structurally satisfies OAuthSessionIssuer (see google-oauth.types.ts)
        // -- reuses the exact session-row-creation primitive password login
        // already uses, with zero changes to the login module itself.
        sessionIssuer: PostgresLoginRepository,
        accessTokenService: AccessTokenService,
      ) =>
        new GoogleOAuthService(
          parseGoogleOAuthEnvironment(process.env),
          transactionStore,
          identityStore,
          tokenExchangeClient,
          idTokenVerifier,
          sessionIssuer,
          accessTokenService,
        ),
    },
    {
      provide: PostgresPasswordCredentialRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresPasswordCredentialRepository(database),
    },
    {
      provide: AccountService,
      inject: [PostgresPasswordCredentialRepository, PostgresOAuthIdentityRepository],
      useFactory: (
        passwordCredentialStore: PostgresPasswordCredentialRepository,
        identityStore: PostgresOAuthIdentityRepository,
      ) => new AccountService(passwordCredentialStore, identityStore),
    },
    AccessTokenGuard,
  ],
  exports: [AccessTokenGuard, AccessTokenService],
})
export class AuthModule {}
