import type {
  DomainAvailabilityProvider,
  DomainAvailabilityResult,
  PricingNature,
} from '@/api/domain-search';

import { formatTime } from '@/lib/format';
export const PROVIDER_ICONS: Record<DomainAvailabilityProvider, string> = {
  cloudflare: 'cloud',
  godaddy: 'language',
  namecheap: 'tag',
  whois: 'travel_explore',
};

export interface StatusPresentation {
  label: string;
  className: string;
  /** Extra explanation for a tooltip / inspector line. */
  detail: string | null;
}

/** Truthful per-provider status: never implies availability the API did not confirm. */
export function describeStatus(result: DomainAvailabilityResult): StatusPresentation {
  if (result.provider === 'whois') {
    return result.available
      ? { className: 'bg-amber-50 text-amber-800 border-amber-200/50', detail: result.reason, label: 'Possibly available' }
      : { className: 'bg-rose-50 text-rose-700 border-rose-200/50', detail: result.reason, label: 'Likely registered' };
  }
  switch (result.state) {
    case 'AVAILABLE':
      return result.errorCode !== null
        ? {
            className: 'bg-amber-50 text-amber-800 border-amber-200/50',
            detail: `Availability confirmed, but the price lookup failed (${result.errorCode}).`,
            label: 'Available · price lookup failed',
          }
        : {
            className: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
            detail: null,
            label: 'Available',
          };
    case 'PREMIUM':
      return {
        className: 'bg-blue-50 text-blue-800 border-blue-200/50',
        detail: 'Available at premium pricing.',
        label: 'Premium',
      };
    case 'UNAVAILABLE':
      return {
        className: 'bg-rose-50 text-rose-700 border-rose-200/50',
        detail:
          'Already registered (or not registrable). Registrars only return prices for registrable domains.',
        label: 'Registered',
      };
    case 'UNCONFIGURED':
      return {
        className: 'bg-surface-container text-secondary border-outline-variant/30',
        detail: 'DomainPulse has no service credentials configured for this registrar yet.',
        label: 'Not configured',
      };
    case 'ERROR':
    default:
      return {
        className: 'bg-amber-50 text-amber-800 border-amber-200/50',
        detail: 'This registrar could not be checked. Other registrars are unaffected.',
        label: result.errorCode ? `Error · ${result.errorCode}` : 'Check failed',
      };
  }
}

export interface BasisPresentation {
  label: string;
  className: string;
  title: string;
}

/** What kind of price this is; null when no price was returned. */
export function describeBasis(nature: PricingNature): BasisPresentation | null {
  switch (nature) {
    case 'INDICATIVE':
      return {
        className: 'bg-amber-50 text-amber-800 border-amber-200/60',
        label: 'Indicative',
        title:
          'Indicative price: GoDaddy documents availability pricing as non-binding. Only a quote locks the price.',
      };
    case 'CURRENT':
      return {
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
        label: 'Live',
        title: "Returned by the registrar's official pricing API for this request.",
      };
    case 'UNKNOWN':
    default:
      return null;
  }
}

export function formatFetchedAt(iso: string): string {
  return formatTime(iso);
}

/**
 * User-facing copy for upstream availability `reason` tokens. Raw
 * machine/provider codes (e.g. `domain_unavailable`) must never reach the
 * UI: known domain-state codes map to professional copy, unknown code-like
 * tokens fall back to a safe generic line, and free-text upstream
 * descriptions (already human-readable) pass through trimmed. The
 * structured backend state is untouched -- only display copy changes.
 */
const KNOWN_REASON_COPY: Record<string, string> = {
  domain_unavailable: 'This domain is already registered.',
  domain_premium: 'Premium name.',
  extension_disallows_registration:
    'This extension cannot be registered through this registrar.',
  extension_not_supported: 'This registrar does not support this extension.',
  extension_not_supported_via_api: 'This registrar does not support this extension.',
};

export function describeProviderReason(reason: string | null): string | null {
  if (reason === null) return null;
  const normalized = reason.trim().toLowerCase();
  if (normalized.length === 0) return null;
  const known = KNOWN_REASON_COPY[normalized];
  if (known !== undefined) return known;
  if (/[^A-Za-z0-9_.-]/u.test(reason)) return reason.trim().slice(0, 256);
  return 'The registrar did not provide more detail.';
}

/** Singular/plural-safe registrar configuration summary ("1 of 3 registrars isn't configured"). */
export function formatRegistrarConfiguration(unconfiguredCount: number, total: number): string {
  const verb = unconfiguredCount === 1 ? "isn't" : "aren't";
  return `${unconfiguredCount} of ${total} registrars ${verb} configured`;
}
