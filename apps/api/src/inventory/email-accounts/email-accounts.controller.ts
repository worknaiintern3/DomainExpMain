import {
  CreateEmailAccountRequestSchema,
  UpdateEmailAccountRequestSchema,
  type CreateEmailAccountRequest,
  type UpdateEmailAccountRequest,
} from '@domainpulse/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '../../auth/http';
import {
  WorkspaceContextGuard,
  type WorkspaceContextRequest,
} from '../../workspace-context';
import { InventoryResourceHttpHandler } from '../http/inventory-http';
import { InventoryService } from '../inventory.service';

@Controller('email-accounts')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class EmailAccountsController {
  private readonly handler: InventoryResourceHttpHandler<
    CreateEmailAccountRequest,
    UpdateEmailAccountRequest
  >;

  constructor(@Inject(InventoryService) service: InventoryService) {
    this.handler = new InventoryResourceHttpHandler(
      service,
      'email-account',
      CreateEmailAccountRequestSchema,
      UpdateEmailAccountRequestSchema,
      (input) => ({ resource: 'email-account', input }),
      (input) => ({ resource: 'email-account', input }),
    );
  }

  @Post()
  create(@Req() request: WorkspaceContextRequest, @Body() body: unknown) {
    return this.handler.create(request, body);
  }

  @Get()
  list(@Req() request: WorkspaceContextRequest, @Query() query: unknown) {
    return this.handler.list(request, query);
  }

  @Get(':id')
  get(@Req() request: WorkspaceContextRequest, @Param() params: unknown) {
    return this.handler.get(request, params);
  }

  @Patch(':id')
  update(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    return this.handler.update(request, params, body);
  }

  @Delete(':id')
  @HttpCode(204)
  archive(@Req() request: WorkspaceContextRequest, @Param() params: unknown) {
    return this.handler.archive(request, params);
  }
}
