export const AWS_PROVIDER_KEY = 'aws';
export const AWS_EC2_INSTANCE_RESOURCE_TYPE = 'ec2-instance';

export const AWS_EC2_API_VERSION = '2016-11-15';
export const AWS_STS_API_VERSION = '2011-06-15';
/** STS's legacy global endpoint; AWS documents `us-east-1` as the signing region for it. */
export const AWS_STS_GLOBAL_HOST = 'sts.amazonaws.com';

export const AWS_DEFAULT_TIMEOUT_MS = 10_000;
export const AWS_MAX_RESPONSE_BYTES = 5_000_000;
export const AWS_MAX_RETRY_AFTER_SECONDS = 86_400;
export const AWS_DEFAULT_MAX_RESULTS = 100;
export const AWS_DEFAULT_MAX_PAGES = 1_000;

export const AWS_MAX_REGIONS = 10;
export const AWS_ACCESS_KEY_ID_PATTERN = /^[A-Z0-9]{16,128}$/u;
export const AWS_REGION_PATTERN = /^[a-z]{2}-[a-z]+-\d$/u;
export const AWS_MAX_SECRET_ACCESS_KEY_LENGTH = 256;
export const AWS_MAX_SESSION_TOKEN_LENGTH = 8_192;
export const AWS_MAX_CREDENTIAL_LENGTH = 16_384;

export interface AwsCredential {
  readonly accessKeyId: string;
  readonly regions: readonly string[];
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
}

export class InvalidAwsCredentialError extends Error {
  constructor() {
    super(
      'AWS credential must be JSON with accessKeyId, secretAccessKey, an optional ' +
      'sessionToken, and a non-empty regions array of canonical AWS region codes',
    );
    this.name = 'InvalidAwsCredentialError';
  }
}

/**
 * AWS credentials are a structured bundle (access key, secret key, optional
 * session token, plus the regions to inventory -- EC2's DescribeInstances is
 * fully region-scoped, unlike GCP's/Azure's list-all-regions endpoints, so
 * Phase 10I requires the caller to name which regions to enumerate rather
 * than silently scanning every AWS region on every sync). Stored as one
 * JSON-encoded string in the same opaque credential column every other
 * provider connection uses (see NamecheapCredential for the precedent).
 */
export function parseAwsCredential(raw: string): AwsCredential {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > AWS_MAX_CREDENTIAL_LENGTH) {
    throw new InvalidAwsCredentialError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidAwsCredentialError();
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidAwsCredentialError();
  }
  const { accessKeyId, secretAccessKey, sessionToken, regions } = parsed as Record<string, unknown>;

  if (typeof accessKeyId !== 'string' || !AWS_ACCESS_KEY_ID_PATTERN.test(accessKeyId)) {
    throw new InvalidAwsCredentialError();
  }
  if (
    typeof secretAccessKey !== 'string' ||
    secretAccessKey.length === 0 ||
    secretAccessKey.length > AWS_MAX_SECRET_ACCESS_KEY_LENGTH
  ) {
    throw new InvalidAwsCredentialError();
  }
  if (
    sessionToken !== undefined &&
    (typeof sessionToken !== 'string' || sessionToken.length === 0 || sessionToken.length > AWS_MAX_SESSION_TOKEN_LENGTH)
  ) {
    throw new InvalidAwsCredentialError();
  }
  if (
    !Array.isArray(regions) ||
    regions.length === 0 ||
    regions.length > AWS_MAX_REGIONS ||
    !regions.every((region) => typeof region === 'string' && AWS_REGION_PATTERN.test(region))
  ) {
    throw new InvalidAwsCredentialError();
  }
  // De-duplicated, so a caller listing the same region twice never doubles
  // the number of regional passes a single sync performs.
  const uniqueRegions = [...new Set(regions as string[])];

  return {
    accessKeyId,
    regions: uniqueRegions,
    secretAccessKey,
    ...(sessionToken !== undefined ? { sessionToken: sessionToken as string } : {}),
  };
}
