import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PlatformRolesGuard } from '../auth/platform-role/platform-roles.guard';
import { AdminPlatformController } from './admin-platform.controller';
import { AdminUsersController } from './admin-users.controller';
import { MobileAdminController } from './mobile-admin.controller';
import { MobileAdminService } from './mobile-admin.service';

@Module({
  imports: [AuthModule],
  controllers: [
    MobileAdminController,
    AdminUsersController,
    AdminPlatformController,
  ],
  providers: [MobileAdminService, PlatformRolesGuard],
  exports: [MobileAdminService],
})
export class MobileAdminModule {}

