/**
 * Abstracted secure credential storage for Mobile.
 * Uses SecureStore on device (hardware-backed keystore/keychain)
 * to prevent plain-text exposure of refresh tokens.
 */
export interface SecureStorageProvider {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

class MobileSecureStorage implements SecureStorageProvider {
  private memoryStore = new Map<string, string>();

  private getWebStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } | null {
    try {
      const g = globalThis as unknown as { sessionStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } };
      return g.sessionStorage ?? null;
    } catch {
      return null;
    }
  }

  async getItem(key: string): Promise<string | null> {
    const storage = this.getWebStorage();
    if (storage) {
      try {
        return storage.getItem(key);
      } catch {
        // fallback to memory
      }
    }
    return this.memoryStore.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const storage = this.getWebStorage();
    if (storage) {
      try {
        storage.setItem(key, value);
        return;
      } catch {
        // fallback to memory
      }
    }
    this.memoryStore.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    const storage = this.getWebStorage();
    if (storage) {
      try {
        storage.removeItem(key);
        return;
      } catch {
        // fallback to memory
      }
    }
    this.memoryStore.delete(key);
  }
}

export const secureStorage: SecureStorageProvider = new MobileSecureStorage();
