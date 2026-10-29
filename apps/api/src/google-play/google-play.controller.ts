import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';

import { AccessTokenService } from '../auth/access-token';
import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/http';
import {
  GooglePlayAccessDeniedError,
  GooglePlayAccessExpiredError,
  GooglePlayDeveloperAccountNotConfiguredError,
  GooglePlayDeveloperAccountNotFoundError,
  GooglePlayNotConnectedError,
  GooglePlayOAuthError,
  GooglePlayRateLimitError,
  GooglePlayTokenRefreshError,
  GooglePlayUnauthorizedError,
} from './google-play.errors';
import { GooglePlayService } from './google-play.service';

const VerifyAccountSchema = z.object({
  developerAccountId: z.string().trim().min(1, 'Developer Account ID is required'),
});

const AuthQuerySchema = z.object({
  developerAccountId: z.string().optional(),
  redirectUri: z.string().optional(),
  token: z.string().optional(),
});

const CallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

@Controller('google-play')
export class GooglePlayController {
  constructor(
    @Inject(GooglePlayService)
    private readonly googlePlayService: GooglePlayService,
    @Inject(AccessTokenService)
    private readonly accessTokenService: AccessTokenService,
  ) {}

  @Get('status')
  @UseGuards(AccessTokenGuard)
  async getStatus(@Req() request: AuthenticatedRequest) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      return await this.googlePlayService.getStatus(userId);
    } catch (err) {
      this.handleError(err);
    }
  }

  @Get('apps')
  @UseGuards(AccessTokenGuard)
  async getApps(@Req() request: AuthenticatedRequest) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      return await this.googlePlayService.getApps(userId);
    } catch (err) {
      this.handleError(err);
    }
  }

  @Post('verify-account')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async verifyAccount(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const parsed = VerifyAccountSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Developer Account ID is required');
    }

    try {
      return await this.googlePlayService.verifyDeveloperAccount(
        userId,
        parsed.data.developerAccountId,
      );
    } catch (err) {
      this.handleError(err);
    }
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async refresh(@Req() request: AuthenticatedRequest) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      return await this.googlePlayService.refreshToken(userId);
    } catch (err) {
      this.handleError(err);
    }
  }

  @Post('disconnect')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async disconnect(@Req() request: AuthenticatedRequest) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      return await this.googlePlayService.disconnect(userId);
    } catch (err) {
      this.handleError(err);
    }
  }

  @Get('auth')
  async startAuth(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
    @Res() reply: FastifyReply,
  ) {
    const parsedQuery = AuthQuerySchema.safeParse(query);
    const token =
      this.extractBearerToken(request.headers.authorization) ||
      (parsedQuery.success ? parsedQuery.data.token : undefined);

    if (!token) {
      throw new UnauthorizedException('Authentication required to connect Google Play Console');
    }

    let userId: string;
    try {
      const principal = this.accessTokenService.verify(token);
      userId = principal.userId;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    try {
      const startParams: {
        userId: string;
        developerAccountId?: string;
        redirectUri?: string;
      } = { userId };

      if (parsedQuery.success && parsedQuery.data.developerAccountId) {
        startParams.developerAccountId = parsedQuery.data.developerAccountId;
      }
      if (parsedQuery.success && parsedQuery.data.redirectUri) {
        startParams.redirectUri = parsedQuery.data.redirectUri;
      }

      const result = await this.googlePlayService.startOAuth(startParams);

      // If requested via browser GET navigation (e.g. Accept text/html), redirect 302
      const accept = request.headers.accept || '';
      if (accept.includes('text/html') && !accept.includes('application/json')) {
        return reply.redirect(result.url, 302);
      }

      return reply.send({
        authUrl: result.url,
        state: result.state,
      });
    } catch (err) {
      this.handleError(err);
    }
  }

  @Get('callback')
  async callback(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
    @Res() reply: FastifyReply,
  ) {
    const isJson = Boolean(request.headers.accept?.includes('application/json'));
    const parsed = CallbackQuerySchema.safeParse(query);
    if (!parsed.success) {
      if (isJson) {
        return reply.status(400).send({
          success: false,
          message: 'Invalid callback parameters received from Google.',
        });
      }
      return this.renderHtmlResult(
        reply,
        false,
        'Invalid callback parameters received from Google.',
      );
    }

    const { code, state, error, error_description } = parsed.data;

    if (error) {
      const isDenied = error === 'access_denied';
      const msg = isDenied
        ? 'Google sign-in was cancelled.'
        : error_description || `Google authorization failed: ${error}`;
      if (isJson) {
        return reply.status(400).send({ success: false, message: msg });
      }
      return this.renderHtmlResult(
        reply,
        false,
        msg,
        isDenied ? 'OAuth cancellation' : 'OAuth failure',
      );
    }

    if (!code || !state) {
      const msg = 'Missing authorization code or state from Google callback.';
      if (isJson) {
        return reply.status(400).send({ success: false, message: msg });
      }
      return this.renderHtmlResult(reply, false, msg);
    }

    try {
      const { connection } = await this.googlePlayService.handleCallback(
        code,
        state,
      );

      if (isJson) {
        return reply.send({
          success: true,
          googleAccountEmail: connection.googleAccountEmail,
          developerAccountId: connection.developerAccountId,
        });
      }

      return this.renderHtmlResult(
        reply,
        true,
        `Google account ${connection.googleAccountEmail} successfully connected to DomainPulse!`,
        'Connected',
        connection.googleAccountEmail,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to complete Google Play account connection.';
      if (isJson) {
        return reply.status(400).send({ success: false, message });
      }
      return this.renderHtmlResult(reply, false, message, 'Connection Error');
    }
  }

  @Post('callback')
  @HttpCode(200)
  async callbackPost(
    @Body() body: unknown,
  ) {
    const parsed = CallbackQuerySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid callback parameters');
    }

    const { code, state, error, error_description } = parsed.data;
    if (error) {
      throw new BadRequestException(error_description || `Google authorization failed: ${error}`);
    }
    if (!code || !state) {
      throw new BadRequestException('Missing authorization code or state');
    }

    try {
      const { connection } = await this.googlePlayService.handleCallback(
        code,
        state,
      );
      return {
        success: true,
        googleAccountEmail: connection.googleAccountEmail,
        developerAccountId: connection.developerAccountId,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to complete Google Play account connection.';
      throw new BadRequestException(message);
    }
  }

  private extractBearerToken(authHeader?: string): string | undefined {
    if (typeof authHeader !== 'string') return undefined;
    const match = /^Bearer ([^\s]+)$/iu.exec(authHeader);
    return match?.[1];
  }

  private handleError(err: unknown): never {
    if (err instanceof GooglePlayNotConnectedError) {
      throw new NotFoundException(err.message);
    }
    if (err instanceof GooglePlayDeveloperAccountNotConfiguredError) {
      throw new BadRequestException(err.message);
    }
    if (err instanceof GooglePlayUnauthorizedError) {
      throw new UnauthorizedException(err.message);
    }
    if (err instanceof GooglePlayAccessExpiredError) {
      throw new ForbiddenException(err.message);
    }
    if (err instanceof GooglePlayAccessDeniedError) {
      throw new ForbiddenException(err.message);
    }
    if (err instanceof GooglePlayDeveloperAccountNotFoundError) {
      throw new NotFoundException(err.message);
    }
    if (err instanceof GooglePlayRateLimitError) {
      throw new HttpException(err.message, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (err instanceof GooglePlayOAuthError) {
      throw new BadRequestException(err.message);
    }
    if (err instanceof GooglePlayTokenRefreshError) {
      throw new UnauthorizedException(err.message);
    }

    if (err instanceof HttpException) {
      throw err;
    }

    const message = err instanceof Error ? err.message : 'Internal Google Play operation failure';
    throw new BadRequestException(message);
  }

  private renderHtmlResult(
    reply: FastifyReply,
    success: boolean,
    message: string,
    title = success ? 'Success' : 'Error',
    email?: string,
  ) {
    const statusColor = success ? '#10b981' : '#ef4444';
    const deepLinkUrl = success
      ? `domainpulse://google-play-callback?success=true${email ? `&email=${encodeURIComponent(email)}` : ''}`
      : `domainpulse://google-play-callback?success=false&error=${encodeURIComponent(message)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DomainPulse - Google Play Console</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: ${statusColor}22;
      color: ${statusColor};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 32px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 22px;
      font-weight: 700;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.5;
      margin: 0 0 24px;
    }
    .btn {
      display: inline-block;
      background: #0284c7;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #0369a1;
    }
  </style>
  <script>
    setTimeout(function() {
      try {
        window.location.href = "${deepLinkUrl}";
      } catch (e) {}
    }, 600);
  </script>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✓' : '✕'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${deepLinkUrl}" class="btn">Return to DomainPulse App</a>
  </div>
</body>
</html>`;

    reply.type('text/html').send(html);
  }
}
