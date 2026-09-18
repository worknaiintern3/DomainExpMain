import { createHash, createHmac } from 'node:crypto';

/**
 * Minimal AWS Signature Version 4 signer for the EC2/STS "query" protocol
 * (a single POST with an `application/x-www-form-urlencoded` `Action` body
 * and no query string). Hand-implemented with Node's built-in `crypto`
 * rather than pulling in the AWS SDK: SigV4 is a small, fully and publicly
 * specified HMAC-SHA256 chain (see AWS's "Signing AWS API requests"
 * documentation), and every other provider adapter in this codebase
 * (Cloudflare/GoDaddy/Namecheap/Hostinger) already authenticates with plain
 * `fetch` and manual response parsing rather than a provider SDK -- this
 * keeps AWS consistent with that pattern and adds zero new dependencies.
 */

export interface AwsSigningCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
}

export interface AwsSignedRequest {
  readonly headers: Readonly<Record<string, string>>;
  readonly url: string;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function amzTimestamp(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}Z$/gu, '');
  return { amzDate: `${iso}Z`, dateStamp: iso.slice(0, 8) };
}

export function signAwsQueryRequest(input: {
  readonly body: string;
  readonly credentials: AwsSigningCredentials;
  readonly host: string;
  readonly now: Date;
  readonly region: string;
  readonly service: 'ec2' | 'sts';
}): AwsSignedRequest {
  const { amzDate, dateStamp } = amzTimestamp(input.now);
  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;

  const canonicalHeadersEntries: [string, string][] = [
    ['content-type', 'application/x-www-form-urlencoded; charset=utf-8'],
    ['host', input.host],
    ['x-amz-date', amzDate],
  ];
  if (input.credentials.sessionToken) {
    canonicalHeadersEntries.push(['x-amz-security-token', input.credentials.sessionToken]);
  }
  canonicalHeadersEntries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalHeaders = canonicalHeadersEntries.map(([key, value]) => `${key}:${value}\n`).join('');
  const signedHeaders = canonicalHeadersEntries.map(([key]) => key).join(';');

  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256Hex(input.body),
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${input.credentials.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    authorization,
    'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
    host: input.host,
    'x-amz-date': amzDate,
  };
  if (input.credentials.sessionToken) {
    headers['x-amz-security-token'] = input.credentials.sessionToken;
  }

  return { headers, url: `https://${input.host}/` };
}
