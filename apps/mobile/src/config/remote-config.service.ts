import {
  MobileBootstrapConfigResponseSchema,
  type MobileBootstrapConfigResponse,
} from '@domainpulse/contracts';

import { DEFAULT_MOBILE_CONFIG } from './default-config';
import { ENV } from './env';

const STORAGE_CACHE_KEY = 'domainpulse_mobile_remote_config';

class RemoteConfigService {
  private cachedConfig: MobileBootstrapConfigResponse = DEFAULT_MOBILE_CONFIG;
  private isInitialized = false;

  async init(): Promise<MobileBootstrapConfigResponse> {
    if (this.isInitialized) {
      return this.cachedConfig;
    }

    // Attempt to load from memory/storage cache
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const validation = MobileBootstrapConfigResponseSchema.safeParse(parsed);
          if (validation.success) {
            this.cachedConfig = validation.data;
          }
        }
      }
    } catch {
      // Storage unavailable, continue with default
    }

    // Refresh from remote API in background or inline
    await this.fetchRemoteConfig();
    this.isInitialized = true;
    return this.cachedConfig;
  }

  async fetchRemoteConfig(): Promise<MobileBootstrapConfigResponse> {
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/mobile/config`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return this.cachedConfig;
      }

      const data = await response.json();
      const validation = MobileBootstrapConfigResponseSchema.safeParse(data);

      if (validation.success) {
        this.cachedConfig = validation.data;
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(validation.data));
          } catch {
            // Quota or storage write error
          }
        }
      }
    } catch {
      // Offline / network failure: gracefully retain existing cached/default config
    }

    return this.cachedConfig;
  }

  getConfig(): MobileBootstrapConfigResponse {
    return this.cachedConfig;
  }

  isFeatureEnabled(featureKey: string): boolean {
    return Boolean(this.cachedConfig.features[featureKey]);
  }
}

export const remoteConfigService = new RemoteConfigService();
