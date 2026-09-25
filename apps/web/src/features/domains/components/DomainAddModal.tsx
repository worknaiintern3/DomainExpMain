import React, { useEffect, useState } from 'react';

export interface DomainAddModalRecord {
  id?: string;
  domainName?: string;
  domain?: string;
  expiresAt?: string | null;
  autoRenew?: boolean | null;
  registrarProviderAccountId?: string | null;
  dnsProviderAccountId?: string | null;
  registeredAt?: string | null;
  notes?: string | null;
}

interface DomainAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (domainData: DomainAddModalRecord) => void;
  editDomain?: DomainAddModalRecord | null;
}

const DOMAIN_FORMAT_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const UUID_FORMAT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DomainAddModal: React.FC<DomainAddModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editDomain,
}) => {
  const [domainName, setDomainName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [autoRenew, setAutoRenew] = useState<'null' | 'true' | 'false'>('null');
  const [registrarProviderAccountId, setRegistrarProviderAccountId] = useState('');
  const [dnsProviderAccountId, setDnsProviderAccountId] = useState('');
  const [registeredAt, setRegisteredAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (editDomain) {
      setDomainName(editDomain.domainName || editDomain.domain || '');
      // Format to YYYY-MM-DD for date picker if ISO string
      const exp = editDomain.expiresAt || '';
      setExpiresAt(exp.includes('T') ? exp.split('T')[0] : exp.slice(0, 10));
      setAutoRenew(
        editDomain.autoRenew === true
          ? 'true'
          : editDomain.autoRenew === false
          ? 'false'
          : 'null',
      );
      setRegistrarProviderAccountId(editDomain.registrarProviderAccountId || '');
      setDnsProviderAccountId(editDomain.dnsProviderAccountId || '');
      const reg = editDomain.registeredAt || '';
      setRegisteredAt(reg.includes('T') ? reg.split('T')[0] : reg.slice(0, 10));
      setNotes(editDomain.notes || '');
    } else {
      setDomainName('');
      setExpiresAt('');
      setAutoRenew('null');
      setRegistrarProviderAccountId('');
      setDnsProviderAccountId('');
      setRegisteredAt('');
      setNotes('');
    }
  }, [editDomain, isOpen]);

  if (!isOpen) return null;

  const handleValidateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validate Domain
    const trimmedDomain = domainName.trim().toLowerCase();
    if (!trimmedDomain) {
      setError('Domain name is required.');
      return;
    }
    if (trimmedDomain.startsWith('http://') || trimmedDomain.startsWith('https://') || trimmedDomain.includes('/')) {
      setError('Domain name must not include http:// or https://.');
      return;
    }
    if (/\s/.test(trimmedDomain)) {
      setError('Domain name cannot contain spaces.');
      return;
    }
    if (!DOMAIN_FORMAT_REGEX.test(trimmedDomain)) {
      setError('Please enter a valid domain name (e.g. example.com).');
      return;
    }

    // 2. Validate Dates
    let expIso: string | null = null;
    if (expiresAt.trim()) {
      const expDate = new Date(expiresAt.trim());
      if (isNaN(expDate.getTime())) {
        setError('Please select a valid expiration date.');
        return;
      }
      expIso = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt.trim())
        ? `${expiresAt.trim()}T00:00:00.000Z`
        : expDate.toISOString();
    }

    let regIso: string | null = null;
    if (registeredAt.trim()) {
      const regDate = new Date(registeredAt.trim());
      if (isNaN(regDate.getTime())) {
        setError('Please select a valid registration date.');
        return;
      }
      regIso = /^\d{4}-\d{2}-\d{2}$/.test(registeredAt.trim())
        ? `${registeredAt.trim()}T00:00:00.000Z`
        : regDate.toISOString();
    }

    if (expIso && regIso) {
      if (new Date(expIso).getTime() <= new Date(regIso).getTime()) {
        setError('Expiration date must be after registration date.');
        return;
      }
    }

    // 3. Validate UUIDs
    const trimmedRegId = registrarProviderAccountId.trim();
    if (trimmedRegId && !UUID_FORMAT_REGEX.test(trimmedRegId)) {
      setError('Registrar account ID must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000) or blank.');
      return;
    }

    const trimmedDnsId = dnsProviderAccountId.trim();
    if (trimmedDnsId && !UUID_FORMAT_REGEX.test(trimmedDnsId)) {
      setError('DNS provider account ID must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000) or blank.');
      return;
    }

    // Submit validated payload
    onSubmit({
      domainName: trimmedDomain,
      domain: trimmedDomain,
      expiresAt: expIso,
      autoRenew: autoRenew === 'true' ? true : autoRenew === 'false' ? false : null,
      registrarProviderAccountId: trimmedRegId || null,
      dnsProviderAccountId: trimmedDnsId || null,
      registeredAt: regIso,
      notes: notes.trim() || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            {editDomain ? 'Edit domain' : 'Add domain'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-error-container/20 border border-error/30 text-error text-body-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            <span>{error}</span>
          </div>
        )}

        {/* Modal Form Grid (Matching Exact Screenshot Layout) */}
        <form onSubmit={handleValidateAndSubmit} className="flex flex-col gap-unit-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
            {/* Domain */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-semibold text-on-surface">
                Domain *
              </label>
              <input
                type="text"
                value={domainName}
                onChange={(e) => {
                  setError(null);
                  setDomainName(e.target.value);
                }}
                placeholder="example.com"
                required
                className="h-10 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Expires at (ISO) with Calendar Picker */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-semibold text-on-surface">
                Expires at (ISO)
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => {
                  setError(null);
                  setExpiresAt(e.target.value);
                }}
                className="h-10 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 mt-0.5">
                <button
                  type="button"
                  className="px-2 py-0.5 text-[11px] rounded bg-surface-container hover:bg-surface-container-high text-primary font-medium transition-colors border border-outline-variant/30"
                  onClick={() => {
                    const d = new Date();
                    d.setFullYear(d.getFullYear() + 1);
                    setError(null);
                    setExpiresAt(d.toISOString().slice(0, 10));
                  }}
                >
                  +1 Year
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 text-[11px] rounded bg-surface-container hover:bg-surface-container-high text-primary font-medium transition-colors border border-outline-variant/30"
                  onClick={() => {
                    const d = new Date();
                    d.setFullYear(d.getFullYear() + 2);
                    setError(null);
                    setExpiresAt(d.toISOString().slice(0, 10));
                  }}
                >
                  +2 Years
                </button>
                {expiresAt && (
                  <button
                    type="button"
                    className="px-2 py-0.5 text-[11px] rounded hover:bg-error-container/20 text-error font-medium transition-colors ml-auto border border-error/20"
                    onClick={() => {
                      setError(null);
                      setExpiresAt('');
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Auto-renew */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-semibold text-on-surface">
                Auto-renew
              </label>
              <select
                value={autoRenew}
                onChange={(e) => setAutoRenew(e.target.value as any)}
                className="h-10 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
              >
                <option value="null">Not recorded</option>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>

            {/* Registrar account ID */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-semibold text-on-surface">
                Registrar account ID
              </label>
              <input
                type="text"
                value={registrarProviderAccountId}
                onChange={(e) => {
                  setError(null);
                  setRegistrarProviderAccountId(e.target.value);
                }}
                placeholder="UUID (e.g. 550e8400-...)"
                className="h-10 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* DNS provider account ID */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-semibold text-on-surface">
                DNS provider account ID
              </label>
              <input
                type="text"
                value={dnsProviderAccountId}
                onChange={(e) => {
                  setError(null);
                  setDnsProviderAccountId(e.target.value);
                }}
                placeholder="UUID (e.g. 550e8400-...)"
                className="h-10 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Registered at (ISO) with Calendar Picker */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-semibold text-on-surface">
                Registered at (ISO)
              </label>
              <input
                type="date"
                value={registeredAt}
                onChange={(e) => {
                  setError(null);
                  setRegisteredAt(e.target.value);
                }}
                className="h-10 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 mt-0.5">
                <button
                  type="button"
                  className="px-2 py-0.5 text-[11px] rounded bg-surface-container hover:bg-surface-container-high text-secondary font-medium transition-colors border border-outline-variant/30"
                  onClick={() => {
                    const d = new Date();
                    setError(null);
                    setRegisteredAt(d.toISOString().slice(0, 10));
                  }}
                >
                  Today
                </button>
                {registeredAt && (
                  <button
                    type="button"
                    className="px-2 py-0.5 text-[11px] rounded hover:bg-error-container/20 text-error font-medium transition-colors ml-auto border border-error/20"
                    onClick={() => {
                      setError(null);
                      setRegisteredAt('');
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs font-semibold text-on-surface">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add administrative notes, registration details, or DNS directives..."
              className="p-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none border border-outline-variant/30"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-unit-sm pt-unit-sm border-t border-surface-container">
            <button
              onClick={onClose}
              className="h-9 px-unit-lg rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors border border-outline-variant/30"
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors font-medium"
              type="submit"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
