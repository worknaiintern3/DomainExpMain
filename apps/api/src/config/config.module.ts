import { Global, Inject, Injectable, Module } from '@nestjs/common';

import {
  parseEnvironment,
  type AppEnvironment,
} from './env.schema';

const APP_ENVIRONMENT = Symbol('APP_ENVIRONMENT');

@Injectable()
export class AppConfigService {
  constructor(
    @Inject(APP_ENVIRONMENT)
    private readonly environment: AppEnvironment,
  ) {}

  get apiHost(): string {
    return this.environment.API_HOST;
  }

  get apiPort(): number {
    return this.environment.API_PORT;
  }

  get corsOrigins(): string[] {
    return this.environment.CORS_ORIGINS;
  }

  get logLevel(): AppEnvironment['LOG_LEVEL'] {
    return this.environment.LOG_LEVEL;
  }

  get nodeEnvironment(): AppEnvironment['NODE_ENV'] {
    return this.environment.NODE_ENV;
  }
}

@Global()
@Module({
  providers: [
    {
      provide: APP_ENVIRONMENT,
      useFactory: (): AppEnvironment => parseEnvironment(process.env),
    },
    AppConfigService,
  ],
  exports: [AppConfigService],
})
export class ConfigModule {}
