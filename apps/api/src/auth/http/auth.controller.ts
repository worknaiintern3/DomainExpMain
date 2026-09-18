import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { AccountService, LastLoginMethodError, PasswordAlreadySetError } from '../account';
import {
  AuthenticatedIdentityNotFoundError,
  IdentityService,
} from '../identity';
import { InvalidCredentialsError } from '../login';
import {
  GoogleAccountAlreadyConnectedError,
  GoogleAccountEmailConflictError,
  GoogleAuthenticationFailedError,
  GoogleIdentityAlreadyLinkedError,
  GoogleOAuthService,
} from '../oauth';
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
  AddPasswordRequestSchema,
  GoogleLinkStartRequestSchema,
  GoogleOAuthCallbackRequestSchema,
  GoogleOAuthStartRequestSchema,
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
    @Inject(RegistrationService)
    private readonly registrationService: RegistrationService,
    @Inject(AuthenticationService)
    private readonly authenticationService: AuthenticationService,
    @Inject(LogoutService)
    private readonly logoutService: LogoutService,
    @Inject(IdentityService)
    private readonly identityService: IdentityService,
    @Inject(GoogleOAuthService)
    private readonly googleOAuthService: GoogleOAuthService,
    @Inject(AccountService)
    private readonly accountService: AccountService,
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

  @Post('google/start')
  @HttpCode(200)
  async googleStart(@Body() body: unknown) {
    parseRequest(GoogleOAuthStartRequestSchema, body, 'Invalid request');
    return await this.googleOAuthService.startLogin();
  }

  @Post('google/callback')
  @HttpCode(200)
  async googleCallback(@Body() body: unknown) {
    const input = parseRequest(
      GoogleOAuthCallbackRequestSchema,
      body,
      'Invalid Google callback request',
    );

    try {
      const result = await this.googleOAuthService.completeCallback(
        input.code,
        input.state,
      );
      return {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        refreshToken: result.refreshToken,
        session: result.session,
        user: toPublicUser(result.user),
      };
    } catch (error) {
      if (error instanceof GoogleAccountEmailConflictError) {
        // Exact locked copy (multi-login delta) -- this is the `detail`
        // field the frontend renders verbatim. Now that Connect Google
        // exists, the copy points the user at it, but this endpoint itself
        // still never auto-links -- email is never authorization.
        throw new ConflictException(
          'An account with this email already exists. Sign in with your password, then connect Google from Security settings.',
        );
      }
      if (error instanceof GoogleAuthenticationFailedError) {
        throw new UnauthorizedException('Authentication failed');
      }

      throw error;
    }
  }

  @Get('login-methods')
  @UseGuards(AccessTokenGuard)
  async loginMethods(@Req() request: AuthenticatedRequest) {
    return await this.accountService.getLoginMethods(
      getPrincipal(request).userId,
    );
  }

  @Post('password/add')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async addPassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = parseRequest(
      AddPasswordRequestSchema,
      body,
      'Invalid password request',
    );
    const userId = getPrincipal(request).userId;

    try {
      await this.accountService.addPassword(userId, input.password);
    } catch (error) {
      if (error instanceof PasswordAlreadySetError) {
        throw new ConflictException(
          'A password is already set for this account',
        );
      }

      throw error;
    }

    return await this.accountService.getLoginMethods(userId);
  }

  @Post('google/link/start')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async googleLinkStart(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    parseRequest(GoogleLinkStartRequestSchema, body, 'Invalid request');
    return await this.googleOAuthService.startLink(
      getPrincipal(request).userId,
    );
  }

  @Post('google/link/callback')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async googleLinkCallback(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = parseRequest(
      GoogleOAuthCallbackRequestSchema,
      body,
      'Invalid Google callback request',
    );

    try {
      return await this.googleOAuthService.completeLinkCallback(
        getPrincipal(request).userId,
        input.code,
        input.state,
      );
    } catch (error) {
      if (error instanceof GoogleIdentityAlreadyLinkedError) {
        throw new ConflictException(
          'This Google account is already connected to a different account',
        );
      }
      if (error instanceof GoogleAccountAlreadyConnectedError) {
        throw new ConflictException(
          'A different Google account is already connected. Disconnect it before connecting a new one.',
        );
      }
      if (error instanceof GoogleAuthenticationFailedError) {
        throw new UnauthorizedException('Authentication failed');
      }

      throw error;
    }
  }

  @Delete('google/link')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async unlinkGoogle(@Req() request: AuthenticatedRequest) {
    const userId = getPrincipal(request).userId;

    try {
      await this.accountService.unlinkGoogle(userId);
    } catch (error) {
      if (error instanceof LastLoginMethodError) {
        throw new ConflictException(
          'Add a password before disconnecting Google, so you always have a way to sign in',
        );
      }

      throw error;
    }

    return await this.accountService.getLoginMethods(userId);
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
