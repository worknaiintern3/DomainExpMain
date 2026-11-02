import {
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/http/access-token.guard';
import { PlatformRoles } from '../auth/platform-role/platform-roles.decorator';
import { PlatformRolesGuard } from '../auth/platform-role/platform-roles.guard';
import { MobileAdminService } from './mobile-admin.service';

@Controller('admin/platform')
export class AdminPlatformController {
  constructor(
    @Inject(MobileAdminService)
    private readonly adminService: MobileAdminService,
  ) {}

  @Post('session')
  async getOrCreateAdminSession() {
    return this.adminService.getOrCreateAdminSession();
  }

  @Get('stats')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @PlatformRoles('SUPER_ADMIN', 'ADMIN')
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('domains')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @PlatformRoles('SUPER_ADMIN', 'ADMIN')
  async getDomains(@Query('search') search?: string) {
    return this.adminService.getAllDomains(search);
  }

  @Get('servers')
  @UseGuards(AccessTokenGuard, PlatformRolesGuard)
  @PlatformRoles('SUPER_ADMIN', 'ADMIN')
  async getServers(@Query('search') search?: string) {
    return this.adminService.getAllServers(search);
  }
}

