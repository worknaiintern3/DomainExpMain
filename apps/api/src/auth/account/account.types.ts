export interface LoginMethodsStatus {
  readonly canUnlinkGoogle: boolean;
  readonly google: {
    readonly connected: boolean;
    readonly email: string | null;
  };
  readonly password: {
    readonly enabled: boolean;
  };
}
