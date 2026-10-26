/**
 * Expiry risk tiers driven by the user's Portfolio settings. The thresholds
 * live in a module-level value that PreferencesProvider updates, so every
 * component and helper that colours or labels an expiry uses the same
 * critical/warning horizons (defaults 7 / 30 days).
 */
export type ExpiryTier = 'critical' | 'warning' | 'healthy';

export interface ExpiryThresholds {
  criticalDays: number;
  warningDays: number;
}

let active: ExpiryThresholds = { criticalDays: 7, warningDays: 30 };

export function configureExpiryThresholds(thresholds: ExpiryThresholds): void {
  active = thresholds;
}

export function getExpiryThresholds(): ExpiryThresholds {
  return active;
}

/** Already expired or within the critical horizon -> critical; within the warning horizon -> warning; otherwise healthy. */
export function expiryTier(daysRemaining: number): ExpiryTier {
  if (daysRemaining <= active.criticalDays) return 'critical';
  if (daysRemaining <= active.warningDays) return 'warning';
  return 'healthy';
}
