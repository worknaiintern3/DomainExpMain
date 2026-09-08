import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import {
  AuthenticatedIdentityNotFoundError,
  IdentityService,
} from '../identity';
import { InvalidCredentialsError } from '../login';
import {
  RegistrationEmailConflictError,
  RegistrationService,
} from '../registration';
import { AuthenticationService } from '../runtime';
import {
  InvalidRefreshTokenError,
  LogoutService,
} from '../session';
import { AccessTokenGuard } from './access-token.guard';
import type { AuthenticatedRequest } from './auth-request';
import {
  LoginRequestSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
} from './auth-input.schemas';

function parseRequest<T>(
  schema: z.ZodType<T>,
  input: unknown,
  failureMessage: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(failureMessage);
  }

  return result.data;
}

function getPrincipal(request: AuthenticatedRequest) {
  if (!request.authPrincipal) {
    throw new UnauthorizedException('Authentication required');
  }

  return request.authPrincipal;
}

function toPublicUser(user: {
  readonly createdAt: Date;
  readonly displayName: string | null;
  readonly email: string;
  readonly id: string;
  readonly updatedAt: Date;
}) {
  return {
    createdAt: user.createdAt,
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    updatedAt: user.updatedAt,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly authenticationService: AuthenticationService,
    private readonly logoutService: LogoutService,
    private readonly identityService: IdentityService,
  ) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const input = parseRequest(
      RegisterRequestSchema,
      body,
      'Invalid registration request',
    );

    try {
      const user = await this.registrationService.register({
        ...(input.displayName === undefined
          ? {}
          : { displayName: input.displayName }),
        email: input.email,
        password: input.password,
      });
      return { user: toPublicUser(user) };
    } catch (error) {
      if (error instanceof RegistrationEmailConflictError) {
        throw new ConflictException('Email is unavailable');
      }

      throw error;
    }
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const input = parseRequest(LoginRequestSchema, body, 'Invalid login request');

    try {
      const result = await this.authenticationService.login(input);
      return {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        refreshToken: result.refreshToken,
        session: result.session,
        user: toPublicUser(result.user),
      };
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException('Invalid email or password');
      }

      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: unknown) {
    const input = parseRequest(
      RefreshRequestSchema,
      body,
      'Invalid refresh request',
    );

    try {
      return await this.authenticationService.refresh(input.refreshToken);
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        throw new UnauthorizedException('Authentication failed');
      }

      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.logoutService.logout(getPrincipal(request));
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@Req() request: AuthenticatedRequest) {
    try {
      const user = await this.identityService.getAuthenticatedUser(
        getPrincipal(request).userId,
      );
      return { user: toPublicUser(user) };
    } catch (error) {
      if (error instanceof AuthenticatedIdentityNotFoundError) {
        throw new UnauthorizedException('Authentication failed');
      }

      throw error;
    }
  }
}
