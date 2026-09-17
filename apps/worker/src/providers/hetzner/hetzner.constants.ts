export const HETZNER_PROVIDER_KEY = 'hetzner';
export const HETZNER_SERVER_RESOURCE_TYPE = 'hetzner.server';

export const HETZNER_API_ORIGIN = 'https://api.hetzner.cloud';
export const HETZNER_API_BASE_PATH = '/v1';
// A small, always-permitted read-only endpoint used only to verify the
// token authenticates -- Hetzner Cloud has no dedicated token-verify route
// (same precedent as digitalocean.adapter.ts's /v2/account use).
export const HETZNER_TOKEN_VERIFY_PATH = '/locations';
export const HETZNER_SERVERS_PATH = '/servers';

export const HETZNER_DEFAULT_TIMEOUT_MS = 8_000;
export const HETZNER_DEFAULT_PAGE_SIZE = 50;
export const HETZNER_MAX_PAGE_SIZE = 50;
export const HETZNER_MIN_PAGE_SIZE = 5;
export const HETZNER_DEFAULT_MAX_PAGES = 1_000;
export const HETZNER_MAX_RESPONSE_BYTES = 2_000_000;
export const HETZNER_MAX_TOKEN_LENGTH = 4_096;
export const HETZNER_MAX_RETRY_AFTER_SECONDS = 86_400;
