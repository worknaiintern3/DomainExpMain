import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';

const IV_LENGTH_BYTES = 12;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

@Injectable()
export class GooglePlayCryptoService {
  private readonly encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = this.resolveKey();
  }

  private resolveKey(): Buffer {
    const candidate =
      process.env.GOOGLE_PLAY_ENCRYPTION_KEY ||
      process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1 ||
      process.env.JWT_ACCESS_TOKEN_SECRET ||
      'domainpulse-google-play-token-default-key-32b';

    // If candidate is a 44-character base64-encoded 32-byte string, decode directly
    if (/^[A-Za-z0-9+/]{43}=$/u.test(candidate)) {
      const decoded = Buffer.from(candidate, 'base64');
      if (decoded.length === 32) {
        return decoded;
      }
    }

    // Otherwise derive a deterministic 32-byte key via SHA-256
    return createHash('sha256').update(candidate, 'utf8').digest();
  }

  encrypt(plaintext: string): string {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a non-empty string');
    }

    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decrypt(encryptedEnvelope: string): string {
    if (!encryptedEnvelope || typeof encryptedEnvelope !== 'string') {
      throw new Error('Invalid encrypted envelope');
    }

    const parts = encryptedEnvelope.split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted envelope');
    }

    const ivBase64 = parts[0];
    const authTagBase64 = parts[1];
    const ciphertextBase64 = parts[2];

    if (!ivBase64 || !authTagBase64 || !ciphertextBase64) {
      throw new Error('Malformed encrypted envelope');
    }

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const ciphertext = Buffer.from(ciphertextBase64, 'base64');

    if (iv.length !== IV_LENGTH_BYTES || authTag.length !== 16) {
      throw new Error('Corrupt encryption envelope parameters');
    }

    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
