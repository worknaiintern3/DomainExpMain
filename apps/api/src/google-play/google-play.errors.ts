export class GooglePlayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GooglePlayError';
  }
}

export class GooglePlayNotConnectedError extends GooglePlayError {
  constructor(message = 'Google Play Console account is not connected') {
    super(message);
    this.name = 'GooglePlayNotConnectedError';
  }
}

export class GooglePlayDeveloperAccountNotConfiguredError extends GooglePlayError {
  constructor(
    message = 'Play Console Developer Account ID has not been linked or verified',
  ) {
    super(message);
    this.name = 'GooglePlayDeveloperAccountNotConfiguredError';
  }
}

export class GooglePlayUnauthorizedError extends GooglePlayError {
  constructor(
    message = 'Google Play authorization has expired or is invalid. Please reconnect your account.',
  ) {
    super(message);
    this.name = 'GooglePlayUnauthorizedError';
  }
}

export class GooglePlayAccessExpiredError extends GooglePlayError {
  constructor(
    message = 'Play Console access has expired. Please check your user permissions in Google Play Console.',
  ) {
    super(message);
    this.name = 'GooglePlayAccessExpiredError';
  }
}

export class GooglePlayAccessDeniedError extends GooglePlayError {
  constructor(
    message = 'Your Google account lacks permissions to view apps on this developer account.',
  ) {
    super(message);
    this.name = 'GooglePlayAccessDeniedError';
  }
}

export class GooglePlayDeveloperAccountNotFoundError extends GooglePlayError {
  constructor(
    message = 'The specified Google Play Developer Account ID was not found or the connected account does not have access.',
  ) {
    super(message);
    this.name = 'GooglePlayDeveloperAccountNotFoundError';
  }
}

export class GooglePlayRateLimitError extends GooglePlayError {
  constructor(
    message = 'Google Play Developer API rate limit reached. Please try again shortly.',
  ) {
    super(message);
    this.name = 'GooglePlayRateLimitError';
  }
}

export class GooglePlayOAuthError extends GooglePlayError {
  constructor(message = 'Google Play OAuth authentication failed') {
    super(message);
    this.name = 'GooglePlayOAuthError';
  }
}

export class GooglePlayOAuthCancellationError extends GooglePlayError {
  constructor(message = 'Google sign-in was cancelled') {
    super(message);
    this.name = 'GooglePlayOAuthCancellationError';
  }
}

export class GooglePlayTokenRefreshError extends GooglePlayError {
  constructor(
    message = 'Failed to refresh Google Play access token. Please re-authenticate.',
  ) {
    super(message);
    this.name = 'GooglePlayTokenRefreshError';
  }
}
