import {
  NOT_READY_RESPONSE,
  NotReadyResponseSchema,
  READY_RESPONSE,
  ReadyResponseSchema,
  type ReadinessResponse,
} from '@domainpulse/contracts';
import { checkDatabaseAvailability } from '@domainpulse/database';
import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { DatabaseService } from '../database/database.service';

@Controller('ready')
export class ReadinessController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async getReadiness(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ReadinessResponse> {
    const availability = await checkDatabaseAvailability(this.database);

    if (availability === 'available') {
      return ReadyResponseSchema.parse(READY_RESPONSE);
    }

    reply.status(503);
    return NotReadyResponseSchema.parse(NOT_READY_RESPONSE);
  }
}
