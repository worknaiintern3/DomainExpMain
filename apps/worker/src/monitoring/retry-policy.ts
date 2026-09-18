const RETRY_DELAYS_MS = new Map<number, number>([
  [2, 5 * 60_000],
  [3, 20 * 60_000],
  [4, 60 * 60_000],
]);

export function retryDelayMs(nextAttemptNo: number): number | undefined {
  return RETRY_DELAYS_MS.get(nextAttemptNo);
}

export function retryIdempotencyKey(
  currentKey: string,
  nextAttemptNo: number,
): string {
  const rootKey = currentKey.replace(/:retry:\d+$/u, '');
  return `${rootKey}:retry:${String(nextAttemptNo)}`;
}

export function canRetry(
  currentAttemptNo: number,
  maximumRetries: number,
  retryable: boolean,
): boolean {
  return (
    retryable
    && currentAttemptNo >= 1
    && currentAttemptNo <= maximumRetries
    && retryDelayMs(currentAttemptNo + 1) !== undefined
  );
}
