import type { LoginInput, LoginUser } from '../login';
import type { RefreshTokenPair } from '../session';

export interface AuthenticationLoginResult extends RefreshTokenPair {
  readonly user: LoginUser;
}

export interface LoginApplicationService {
  login(input: LoginInput): Promise<AuthenticationLoginResult>;
}

export interface RefreshApplicationService {
  refresh(refreshToken: string): Promise<RefreshTokenPair>;
}
