import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import type { MobileBootstrapConfigResponse } from '@domainpulse/contracts';

import { MobileClientService } from './mobile-client.service';

@Controller('mobile')
export class MobileClientController {
  constructor(
    @Inject(MobileClientService)
    private readonly mobileClientService: MobileClientService,
  ) {}

  @Get('config')
  async getConfig(): Promise<MobileBootstrapConfigResponse> {
    return this.mobileClientService.getBootstrapConfig();
  }

  @Get('session')
  async getSession() {
    return this.mobileClientService.getOrCreateMobileSession();
  }

  @Post('session')
  async createSession(@Body() body?: { email?: string }) {
    return this.mobileClientService.getOrCreateMobileSession(body?.email);
  }
}
