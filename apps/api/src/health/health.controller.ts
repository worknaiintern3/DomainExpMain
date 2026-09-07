import {
  HEALTH_RESPONSE,
  HealthResponseSchema,
  type HealthResponse,
} from '@domainpulse/contracts';
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return HealthResponseSchema.parse(HEALTH_RESPONSE);
  }
}
