import type { AccessTokenService } from '../access-token';
import type { LoginInput, LoginService } from '../login';
import type {
  AuthenticationLoginResult,
  LoginApplicationService,
  RefreshApplicationService,
} from './authentication.types';
import type { RefreshTokenPair, RefreshTokenService } from '../session';

export class AuthenticationService
  implements LoginApplicationService, RefreshApplicationService
{
  constructor(
    private readonly loginService: LoginService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async login(input: LoginInput): Promise<AuthenticationLoginResult> {
    const login = await this.loginService.login(input);
    const accessToken = this.accessTokenService.issue({
      sessionId: login.session.id,
      userId: login.user.id,
    });

    return {
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken: login.refreshToken,
      session: login.session,
      user: login.user,
    };
  }

  refresh(refreshToken: string): Promise<RefreshTokenPair> {
    return this.refreshTokenService.refresh(refreshToken);
  }
}
