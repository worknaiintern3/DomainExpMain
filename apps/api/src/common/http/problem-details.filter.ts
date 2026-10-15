import type { ProblemDetails } from '@domainpulse/contracts';
import {
  ArgumentsHost,
  Catch,
  HttpException,
  Inject,
  Injectable,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { STATUS_CODES } from 'node:http';

interface RequestContext {
  id?: string;
  url?: string;
}

function getHttpExceptionDetail(exception: HttpException): string {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return response;
  }

  const message = 'message' in response ? response.message : undefined;
  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string').join('; ');
  }

  return typeof message === 'string' ? message : STATUS_CODES[exception.getStatus()] ?? 'Request failed';
}

export function toProblemDetails(
  exception: unknown,
  request: RequestContext,
): ProblemDetails {
  const status =
    exception instanceof HttpException
      ? exception.getStatus()
      : 500;
  const title = STATUS_CODES[status] ?? 'Error';
  const detail =
    status >= 500
      ? 'An unexpected error occurred.'
      : exception instanceof HttpException
      ? getHttpExceptionDetail(exception)
      : exception instanceof Error
      ? `${exception.name}: ${exception.message}`
      : 'An unexpected error occurred.';

  return {
    type: 'about:blank',
    title,
    status,
    detail,
    instance: request.url ?? '/',
    requestId: request.id ?? 'unavailable',
    timestamp: new Date().toISOString(),
  };
}

@Catch()
@Injectable()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(@Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const response: unknown = context.getResponse<unknown>();
    const problem = toProblemDetails(exception, request);

    if (!(exception instanceof HttpException)) {
      const errorName = exception instanceof Error ? exception.name : 'UnknownError';
      const errorMessage = exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        JSON.stringify({
          event: 'unhandled_http_error',
          errorName,
          errorMessage,
          stack,
          requestId: problem.requestId,
          status: problem.status,
        }),
      );
    }

    this.adapterHost.httpAdapter.reply(response, problem, problem.status);
  }
}
