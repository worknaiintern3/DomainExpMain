import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  AccessTokenService,
  parseAccessTokenEnvironment,
} from './access-token';
import {
  AccountService,
  MongoPasswordCredentialRepository,
} from './account';
import { AuthController, AccessTokenGuard } from './http';
import {
  IdentityService,
  MongoIdentityRepository,
} from './identity';
import {
  LoginService,
  MongoLoginRepository,
} from './login';
import {
  GoogleIdTokenVerifier,
  GoogleOAuthService,
  GoogleTokenExchangeClient,
  MongoOAuthIdentityRepository,
  MongoOAuthTransactionRepository,
  parseGoogleOAuthEnvironment,
} from './oauth';
import {
  MongoRegistrationRepository,
  RegistrationService,
} from './registration';
import { AuthenticationService } from './runtime';
import {
  LogoutService,
  MongoSessionRepository,
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
      provide: MongoRegistrationRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoRegistrationRepository(database),
    },
    {
      provide: RegistrationService,
      inject: [MongoRegistrationRepository],
      useFactory: (repository: MongoRegistrationRepository) =>
        new RegistrationService(repository),
    },
    {
      provide: MongoLoginRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoLoginRepository(database),
    },
    {
      provide: LoginService,
      inject: [MongoLoginRepository],
      useFactory: (repository: MongoLoginRepository) =>
        new LoginService(repository),
    },
    {
      provide: MongoSessionRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoSessionRepository(database),
    },
    {
      provide: RefreshTokenService,
      inject: [MongoSessionRepository, AccessTokenService],
      useFactory: (
        repository: MongoSessionRepository,
        accessTokenService: AccessTokenService,
      ) => new RefreshTokenService(repository, accessTokenService),
    },
    {
      provide: LogoutService,
      inject: [MongoSessionRepository],
      useFactory: (repository: MongoSessionRepository) =>
        new LogoutService(repository),
    },
    {
      provide: MongoIdentityRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoIdentityRepository(database),
    },
    {
      provide: IdentityService,
      inject: [MongoIdentityRepository],
      useFactory: (repository: MongoIdentityRepository) =>
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
      provide: MongoOAuthTransactionRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoOAuthTransactionRepository(database),
    },
    {
      provide: MongoOAuthIdentityRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoOAuthIdentityRepository(database),
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
        MongoOAuthTransactionRepository,
        MongoOAuthIdentityRepository,
        GoogleTokenExchangeClient,
        GoogleIdTokenVerifier,
        MongoLoginRepository,
        AccessTokenService,
      ],
      useFactory: (
        transactionStore: MongoOAuthTransactionRepository,
        identityStore: MongoOAuthIdentityRepository,
        tokenExchangeClient: GoogleTokenExchangeClient,
        idTokenVerifier: GoogleIdTokenVerifier,
        sessionIssuer: MongoLoginRepository,
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
      provide: MongoPasswordCredentialRepository,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new MongoPasswordCredentialRepository(database),
    },
    {
      provide: AccountService,
      inject: [MongoPasswordCredentialRepository, MongoOAuthIdentityRepository],
      useFactory: (
        passwordCredentialStore: MongoPasswordCredentialRepository,
        identityStore: MongoOAuthIdentityRepository,
      ) => new AccountService(passwordCredentialStore, identityStore),
    },
    AccessTokenGuard,
  ],
  exports: [AccessTokenGuard, AccessTokenService],
})
export class AuthModule {}
