import type { FastifyRequest } from 'fastify';

import type { AuthenticatedPrincipal } from '../access-token';

export interface AuthenticatedRequest extends FastifyRequest {
  authPrincipal?: AuthenticatedPrincipal;
}
