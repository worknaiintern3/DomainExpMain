import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import {
  PASSWORD_HASH_ALGORITHM,
  PASSWORD_HASH_BYTES,
  PASSWORD_HASH_MAX_ENCODED_LENGTH,
  PASSWORD_HASH_VERSION,
  PASSWORD_SALT_BYTES,
  PASSWORD_SCRYPT_PARAMETERS,
} from './auth-crypto.constants';

interface ParsedPasswordHash {
  derivedKey: Buffer;
  salt: Buffer;
}

const ENCODED_PASSWORD_HASH_PATTERN =
  /^\$([a-z0-9-]+)\$v=(\d+)\$N=(\d+),r=(\d+),p=(\d+),l=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/u;

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      PASSWORD_HASH_BYTES,
      PASSWORD_SCRYPT_PARAMETERS,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

function decodeCanonicalBase64Url(
  value: string,
  expectedBytes: number,
): Buffer | undefined {
  const decoded = Buffer.from(value, 'base64url');

  if (
    decoded.length !== expectedBytes ||
    decoded.toString('base64url') !== value
  ) {
    return undefined;
  }

  return decoded;
}

function parsePasswordHash(storedHash: string): ParsedPasswordHash | undefined {
  if (
    typeof storedHash !== 'string' ||
    storedHash.length > PASSWORD_HASH_MAX_ENCODED_LENGTH
  ) {
    return undefined;
  }

  const match = ENCODED_PASSWORD_HASH_PATTERN.exec(storedHash);
  if (!match) {
    return undefined;
  }

  const [
    ,
    algorithm,
    version,
    cost,
    blockSize,
    parallelization,
    hashBytes,
    encodedSalt,
    encodedDerivedKey,
  ] = match;

  if (
    algorithm !== PASSWORD_HASH_ALGORITHM ||
    Number(version) !== PASSWORD_HASH_VERSION ||
    Number(cost) !== PASSWORD_SCRYPT_PARAMETERS.N ||
    Number(blockSize) !== PASSWORD_SCRYPT_PARAMETERS.r ||
    Number(parallelization) !== PASSWORD_SCRYPT_PARAMETERS.p ||
    Number(hashBytes) !== PASSWORD_HASH_BYTES ||
    !encodedSalt ||
    !encodedDerivedKey
  ) {
    return undefined;
  }

  const salt = decodeCanonicalBase64Url(encodedSalt, PASSWORD_SALT_BYTES);
  const derivedKey = decodeCanonicalBase64Url(
    encodedDerivedKey,
    PASSWORD_HASH_BYTES,
  );

  if (!salt || !derivedKey) {
    return undefined;
  }

  return { derivedKey, salt };
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string');
  }

  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = await derivePasswordKey(password, salt);
  const parameters = [
    `N=${String(PASSWORD_SCRYPT_PARAMETERS.N)}`,
    `r=${String(PASSWORD_SCRYPT_PARAMETERS.r)}`,
    `p=${String(PASSWORD_SCRYPT_PARAMETERS.p)}`,
    `l=${String(PASSWORD_HASH_BYTES)}`,
  ].join(',');

  return [
    '',
    PASSWORD_HASH_ALGORITHM,
    `v=${String(PASSWORD_HASH_VERSION)}`,
    parameters,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (typeof password !== 'string') {
    return false;
  }

  const parsedHash = parsePasswordHash(storedHash);
  if (!parsedHash) {
    return false;
  }

  const candidateKey = await derivePasswordKey(password, parsedHash.salt);
  return timingSafeEqual(candidateKey, parsedHash.derivedKey);
}
