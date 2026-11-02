/**
 * Native intent interceptor for Expo Router.
 * Ensures incoming deep links, system launches, and Expo Go launch paths
 * always produce a valid, well-formed initial navigation state.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (!path || path === '/' || path.trim() === '') {
      return '/index';
    }
    // Clean up any double slashes or Expo Go dev query wrappers
    const cleaned = path.replace(/\/+/g, '/');
    if (cleaned === '/' || cleaned === '') {
      return '/index';
    }
    return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  } catch {
    return '/index';
  }
}
