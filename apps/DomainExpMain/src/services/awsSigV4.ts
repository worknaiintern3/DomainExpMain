// Pure JavaScript AWS Signature Version 4 Signer and Live AWS Resource Fetcher
// Self-contained with zero native Node.js crypto dependencies for 100% cross-platform
// compatibility across iOS, Android, and Web in Expo / React Native.

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  regions?: string[];
}

export interface DiscoveredAwsServer {
  name: string;
  hostname?: string;
  ip?: string;
  os?: string;
  status?: string;
  region?: string;
}

// -------------------------------------------------------------
// Pure JS SHA-256 and HMAC-SHA-256 Engine
// -------------------------------------------------------------

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

export function sha256Bytes(message: string | Uint8Array): Uint8Array {
  let bytes: Uint8Array;
  if (typeof message === 'string') {
    bytes = new TextEncoder().encode(message);
  } else {
    bytes = message;
  }

  const bitLen = bytes.length * 8;
  const newLen = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(newLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(newLen - 4, bitLen & 0xffffffff, false);
  view.setUint32(newLen - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < newLen; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const outView = new DataView(result.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return result;
}

export function sha256Hex(message: string | Uint8Array): string {
  return Array.from(sha256Bytes(message)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hmacSha256(key: string | Uint8Array, message: string | Uint8Array): Uint8Array {
  let keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const msgBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;

  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const paddedKey = new Uint8Array(64);
  paddedKey.set(keyBytes);

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const innerMsg = new Uint8Array(64 + msgBytes.length);
  innerMsg.set(iKeyPad, 0);
  innerMsg.set(msgBytes, 64);
  const innerHash = sha256Bytes(innerMsg);

  const outerMsg = new Uint8Array(64 + 32);
  outerMsg.set(oKeyPad, 0);
  outerMsg.set(innerHash, 64);
  return sha256Bytes(outerMsg);
}

export function hmacSha256Hex(key: string | Uint8Array, message: string | Uint8Array): string {
  return Array.from(hmacSha256(key, message)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// -------------------------------------------------------------
// AWS SigV4 Request Signer
// -------------------------------------------------------------

export function signAwsRequest(input: {
  method: 'GET' | 'POST';
  path: string;
  queryParams?: Record<string, string>;
  body?: string;
  host: string;
  service: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  now?: Date;
}): { headers: Record<string, string>; url: string } {
  const now = input.now ?? new Date();
  const iso = now.toISOString().replace(/[:-]|\.\d{3}Z$/gu, '');
  const amzDate = `${iso}Z`;
  const dateStamp = iso.slice(0, 8);
  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;

  const canonicalHeadersEntries: [string, string][] = [
    ['host', input.host],
    ['x-amz-date', amzDate],
  ];
  if (input.body !== undefined) {
    canonicalHeadersEntries.push(['content-type', 'application/x-www-form-urlencoded; charset=utf-8']);
  }
  if (input.sessionToken) {
    canonicalHeadersEntries.push(['x-amz-security-token', input.sessionToken]);
  }
  canonicalHeadersEntries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalHeaders = canonicalHeadersEntries.map(([key, value]) => `${key}:${value}\n`).join('');
  const signedHeaders = canonicalHeadersEntries.map(([key]) => key).join(';');

  // Canonical Query String
  const queryKeys = Object.keys(input.queryParams ?? {}).sort();
  const canonicalQuery = queryKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(input.queryParams![k])}`)
    .join('&');

  const payloadHash = sha256Hex(input.body || '');

  const canonicalRequest = [
    input.method,
    input.path || '/',
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${input.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, input.region);
  const kService = hmacSha256(kRegion, input.service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256Hex(kSigning, stringToSign);

  const authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    authorization,
    host: input.host,
    'x-amz-date': amzDate,
  };
  if (input.body !== undefined) {
    headers['content-type'] = 'application/x-www-form-urlencoded; charset=utf-8';
  }
  if (input.sessionToken) {
    headers['x-amz-security-token'] = input.sessionToken;
  }

  const url = `https://${input.host}${input.path}${canonicalQuery ? `?${canonicalQuery}` : ''}`;
  return { headers, url };
}

// -------------------------------------------------------------
// Error Classifier
// -------------------------------------------------------------

export function extractAwsError(xml: string, httpStatus: number): string {
  const codeMatch = xml.match(/<Code>([^<]+)<\/Code>/i);
  const messageMatch = xml.match(/<Message>([^<]+)<\/Message>/i);
  const code = codeMatch ? codeMatch[1] : undefined;
  const message = messageMatch ? messageMatch[1] : undefined;

  if (code && message) {
    return `AWS Authentication error (${code}): ${message}`;
  }
  if (code) {
    return `AWS Error: ${code}`;
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return `AWS Authentication failed (HTTP ${httpStatus}): Invalid Access Key ID, Secret Access Key, or missing IAM permissions.`;
  }
  return `AWS request failed with status HTTP ${httpStatus}.`;
}

// -------------------------------------------------------------
// Live Route53 Hosted Zones Discovery
// -------------------------------------------------------------

export async function fetchAwsRoute53Domains(creds: AwsCredentials): Promise<{
  domains: string[];
  error?: string;
}> {
  const domains: string[] = [];
  let primaryError: string | undefined;

  // 1. Live Route53 Hosted Zones (DNS)
  try {
    const { headers, url } = signAwsRequest({
      method: 'GET',
      path: '/2013-04-01/hostedzone',
      host: 'route53.amazonaws.com',
      service: 'route53',
      region: 'us-east-1', // Route53 global service endpoint signs with us-east-1
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    });

    const res = await fetch(url, { method: 'GET', headers });
    const text = await res.text();

    if (res.ok) {
      const matches = text.matchAll(/<HostedZone>[\s\S]*?<Name>([^<]+)<\/Name>/g);
      for (const match of matches) {
        let domain = match[1].trim();
        if (domain.endsWith('.')) {
          domain = domain.slice(0, -1);
        }
        if (domain && domain.includes('.')) {
          const domLower = domain.toLowerCase();
          if (!domains.includes(domLower)) domains.push(domLower);
        }
      }
    } else {
      primaryError = extractAwsError(text, res.status);
    }
  } catch (err: any) {
    primaryError = `Network error connecting to AWS Route53: ${err?.message || 'Failed to fetch'}`;
  }

  // 2. Also check Route 53 Registered Domains (AWS Registrar domains)
  try {
    const host = 'route53domains.us-east-1.amazonaws.com';
    const amzTarget = 'Route53Domains_v20140515.ListDomains';
    const contentType = 'application/x-amz-json-1.1';
    const body = '{}';

    const now = new Date();
    const iso = now.toISOString().replace(/[:-]|\.\d{3}Z$/gu, '');
    const amzDate = `${iso}Z`;
    const dateStamp = iso.slice(0, 8);
    const credentialScope = `${dateStamp}/us-east-1/route53domains/aws4_request`;

    const canonicalHeadersEntries: [string, string][] = [
      ['content-type', contentType],
      ['host', host],
      ['x-amz-date', amzDate],
      ['x-amz-target', amzTarget],
    ];
    if (creds.sessionToken) {
      canonicalHeadersEntries.push(['x-amz-security-token', creds.sessionToken]);
    }
    canonicalHeadersEntries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const canonicalHeaders = canonicalHeadersEntries.map(([k, v]) => `${k}:${v}\n`).join('');
    const signedHeaders = canonicalHeadersEntries.map(([k]) => k).join(';');
    const payloadHash = sha256Hex(body);

    const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

    const kDate = hmacSha256(`AWS4${creds.secretAccessKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, 'us-east-1');
    const kService = hmacSha256(kRegion, 'route53domains');
    const kSigning = hmacSha256(kService, 'aws4_request');
    const signature = hmacSha256Hex(kSigning, stringToSign);

    const authorization = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      authorization,
      host,
      'x-amz-date': amzDate,
      'x-amz-target': amzTarget,
      'content-type': contentType,
    };
    if (creds.sessionToken) {
      headers['x-amz-security-token'] = creds.sessionToken;
    }

    const resDomains = await fetch(`https://${host}/`, { method: 'POST', headers, body });
    if (resDomains.ok) {
      const json = await resDomains.json();
      if (Array.isArray(json?.Domains)) {
        for (const d of json.Domains) {
          const name = (d?.DomainName || '').trim().toLowerCase();
          if (name && name.includes('.') && !domains.includes(name)) {
            domains.push(name);
          }
        }
      }
    } else if (domains.length === 0 && !primaryError) {
      const errText = await resDomains.text();
      primaryError = extractAwsError(errText, resDomains.status);
    }
  } catch {}

  return { domains, error: domains.length > 0 ? undefined : primaryError };
}

// -------------------------------------------------------------
// Live EC2 Regions Discovery
// -------------------------------------------------------------

export async function fetchAwsDescribeRegions(creds: AwsCredentials): Promise<string[]> {
  try {
    const body = 'Action=DescribeRegions&Version=2016-11-15';
    const host = 'ec2.us-east-1.amazonaws.com';
    const { headers, url } = signAwsRequest({
      method: 'POST',
      path: '/',
      body,
      host,
      service: 'ec2',
      region: 'us-east-1',
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    });
    const res = await fetch(url, { method: 'POST', headers, body });
    if (res.ok) {
      const text = await res.text();
      const regionNames = [...text.matchAll(/<regionName>([^<]+)<\/regionName>/g)].map((m) => m[1].trim());
      if (regionNames.length > 0) return regionNames;
    }
  } catch {}
  return ['us-east-1', 'eu-north-1', 'ap-south-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'];
}

// -------------------------------------------------------------
// Live EC2 Instances Discovery Across Configured Regions
// -------------------------------------------------------------

export async function fetchAwsEc2Instances(
  creds: AwsCredentials,
  regions?: string[],
): Promise<{
  servers: DiscoveredAwsServer[];
  inferredDomains: string[];
  error?: string;
}> {
  const servers: DiscoveredAwsServer[] = [];
  const inferredDomains: string[] = [];
  let primaryError: string | undefined;

  let targetRegions =
    regions && regions.length > 0
      ? regions
      : creds.regions && creds.regions.length > 0
      ? creds.regions
      : [];

  // If no region or default ['us-east-1', 'ap-south-1'] specified, dynamically query DescribeRegions to inventory all user regions
  const isDefaultOrSingle =
    targetRegions.length === 0 ||
    (targetRegions.length <= 2 && targetRegions.every((r) => r.toLowerCase() === 'us-east-1' || r.toLowerCase() === 'ap-south-1'));

  if (isDefaultOrSingle) {
    const discoveredRegions = await fetchAwsDescribeRegions(creds);
    targetRegions = [...new Set([...targetRegions, ...discoveredRegions])];
  }

  for (const region of targetRegions) {
    const cleanRegion = region.trim().toLowerCase();
    if (!cleanRegion) continue;

    try {
      const body = 'Action=DescribeInstances&Version=2016-11-15';
      const host = `ec2.${cleanRegion}.amazonaws.com`;

      const { headers, url } = signAwsRequest({
        method: 'POST',
        path: '/',
        body,
        host,
        service: 'ec2',
        region: cleanRegion,
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      });

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      const text = await res.text();

      if (res.ok) {
        const instancesSets = text.match(/<instancesSet>[\s\S]*?<\/instancesSet>/g) || [];
        for (const set of instancesSets) {
          // Boundary-aware instance block extraction: each instance begins at <instanceId>
          const idPositions: { id: string; index: number }[] = [];
          const idRegex = /<instanceId>([^<]+)<\/instanceId>/g;
          let m: RegExpExecArray | null;
          while ((m = idRegex.exec(set)) !== null) {
            idPositions.push({ id: m[1], index: m.index });
          }

          for (let i = 0; i < idPositions.length; i++) {
            const current = idPositions[i];
            const nextIndex = i + 1 < idPositions.length ? idPositions[i + 1].index : set.length;
            const block = set.slice(current.index, nextIndex);

            const instanceId = current.id;
            const ipMatch = block.match(/<ipAddress>([^<]+)<\/ipAddress>/) || block.match(/<association>[\s\S]*?<publicIp>([^<]+)<\/publicIp>/);
            const privateIpMatch = block.match(/<privateIpAddress>([^<]+)<\/privateIpAddress>/);
            const dnsMatch = block.match(/<publicDnsName>([^<]+)<\/publicDnsName>/) || block.match(/<dnsName>([^<]+)<\/dnsName>/);
            const stateMatch = block.match(/<instanceState>[\s\S]*?<name>([^<]+)<\/name>/);
            const typeMatch = block.match(/<instanceType>([^<]+)<\/instanceType>/);
            const tagMatch = block.match(/<tagSet>[\s\S]*?<key>Name<\/key>[\s\S]*?<value>([^<]+)<\/value>/i);
            const keyNameMatch = block.match(/<keyName>([^<]+)<\/keyName>/);
            const platformMatch = block.match(/<platformDetails>([^<]+)<\/platformDetails>/);

            const name = tagMatch ? tagMatch[1].trim() : keyNameMatch ? `AWS: ${keyNameMatch[1].trim()}` : `AWS EC2 (${instanceId})`;
            const publicIp = ipMatch ? ipMatch[1].trim() : undefined;
            const privateIp = privateIpMatch ? privateIpMatch[1].trim() : undefined;
            const publicDns = dnsMatch && dnsMatch[1].trim() ? dnsMatch[1].trim() : undefined;
            const stateName = stateMatch ? stateMatch[1].trim() : 'running';
            const status = stateName === 'running' ? 'healthy' : stateName === 'stopped' ? 'offline' : stateName;
            const instanceType = typeMatch ? typeMatch[1].trim() : 't3.micro';
            const platform = platformMatch ? platformMatch[1].trim() : 'Linux/UNIX';

            servers.push({
              name,
              hostname: publicDns || publicIp || name,
              ip: publicIp || privateIp,
              os: `${platform} (${instanceType})`,
              status,
              region: cleanRegion,
            });

            // Extract custom domain pointers (STRICTLY excluding all aws / amazon infrastructure hostnames)
            if (publicDns && publicDns.includes('.')) {
              if (
                !publicDns.endsWith('.amazonaws.com') &&
                !publicDns.endsWith('.amazon.com') &&
                !publicDns.endsWith('.internal')
              ) {
                inferredDomains.push(publicDns);
              }
            }
          }
        }
      } else {
        if (!primaryError && servers.length === 0) {
          primaryError = extractAwsError(text, res.status);
        }
      }
    } catch (err: any) {
      if (!primaryError && servers.length === 0) {
        primaryError = `Failed to query EC2 in ${cleanRegion}: ${err?.message || 'Network error'}`;
      }
    }
  }

  return { servers, inferredDomains, error: servers.length > 0 ? undefined : primaryError };
}
