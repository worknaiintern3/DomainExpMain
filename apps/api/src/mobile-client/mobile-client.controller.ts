import { Body, Controller, Get, Inject, NotFoundException, Post } from '@nestjs/common';
import type { MobileBootstrapConfigResponse } from '@domainpulse/contracts';

import { MobileClientService } from './mobile-client.service';
import { AppConfigService } from '../config/config.module';

@Controller('mobile')
export class MobileClientController {
  constructor(
    @Inject(MobileClientService)
    private readonly mobileClientService: MobileClientService,
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
  ) {}

  @Get('config')
  async getConfig(): Promise<MobileBootstrapConfigResponse> {
    return this.mobileClientService.getBootstrapConfig();
  }

  @Get('session')
  async getSession() {
    this.assertDevelopmentSession();
    return this.mobileClientService.getOrCreateMobileSession();
  }

  @Post('session')
  async createSession(@Body() body?: { email?: string }) {
    this.assertDevelopmentSession();
    return this.mobileClientService.getOrCreateMobileSession(body?.email);
  }

  private assertDevelopmentSession(): void {
    // This helper selects an account without checking credentials.
    // Public deployments must use the authenticated login/OAuth endpoints.
    if (this.config.nodeEnvironment === 'production') {
      throw new NotFoundException();
    }
  }
}
