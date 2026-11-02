import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/http/access-token.guard';
import type { AuthenticatedRequest } from '../auth/http/auth-request';
import { PlatformRoles } from '../auth/platform-role/platform-roles.decorator';
import { PlatformRolesGuard } from '../auth/platform-role/platform-roles.guard';
import { MobileAdminService } from './mobile-admin.service';

@Controller('admin/users')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@PlatformRoles('SUPER_ADMIN', 'ADMIN')
export class AdminUsersController {
  constructor(
    @Inject(MobileAdminService)
    private readonly adminService: MobileAdminService,
  ) {}

  @Get()
  async getUsers(
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers({ type, search, status, role });
  }

  @Get(':id')
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.updateUser(
      id,
      body,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  @Post(':id/revoke-sessions')
  async revokeSessions(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.revokeUserSessions(
      id,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  @Post(':id/notify')
  async sendNotification(
    @Param('id') id: string,
    @Body() body: { title: string; message: string; channel?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.sendUserNotification(
      id,
      body,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  @Post('broadcast')
  async broadcastNotification(
    @Body() body: { title: string; message: string; platform?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.broadcastPushNotification(
      body,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  @Delete(':id')
  async deleteUser(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.deleteUser(
      id,
      req.authPrincipal?.userId,
      req.ip,
    );
  }
}

