import { Controller, Get, Inject } from '@nestjs/common';
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
}
