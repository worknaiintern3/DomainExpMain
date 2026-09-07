import React from 'react';
import { GeneralSettings } from '../../settings.types';
import {
  TIMEZONE_OPTIONS,
  DATE_FORMAT_OPTIONS,
  CURRENCY_OPTIONS,
  LANDING_PAGE_OPTIONS,
} from '../../settings.reference';

interface GeneralTabProps {
  settings: GeneralSettings;
  onChange: (updated: Partial<GeneralSettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  settings,
  onChange,
  onSave,
  isSaving,
}) => {
  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            General Preferences
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Basic workspace display, localization, and navigation defaults for active sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md mt-unit-md">
          {/* Workspace Display Name */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Workspace Display Name
            </label>
            <input
              type="text"
              value={settings.workspaceDisplayName}
              onChange={(e) => onChange({ workspaceDisplayName: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro"
            />
            <span className="font-caption-xs text-caption-xs text-secondary">
              Visible on portfolio headers and generated summaries.
            </span>
          </div>

          {/* Workspace Name */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Workspace Name
            </label>
            <input
              type="text"
              value={settings.workspaceName}
              onChange={(e) => onChange({ workspaceName: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro"
            />
            <span className="font-caption-xs text-caption-xs text-secondary">
              Internal portfolio identifier for stored records.
            </span>
          </div>

          {/* Default Landing Page */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Default Landing Page
            </label>
            <select
              value={settings.defaultLandingPage}
              onChange={(e) => onChange({ defaultLandingPage: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro cursor-pointer"
            >
              {LANDING_PAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Initial workspace view loaded upon application launch.
            </span>
          </div>

          {/* Default Currency */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Default Currency
            </label>
            <select
              value={settings.defaultCurrency}
              onChange={(e) => onChange({ defaultCurrency: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro cursor-pointer"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Primary valuation denomination for portfolio and price checks.
            </span>
          </div>

          {/* Date Format */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Date Format
            </label>
            <select
              value={settings.dateFormat}
              onChange={(e) => onChange({ dateFormat: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro cursor-pointer"
            >
              {DATE_FORMAT_OPTIONS.map((fmt) => (
                <option key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </option>
              ))}
            </select>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Applied across expiration monitors and audit histories.
            </span>
          </div>

          {/* Timezone */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro cursor-pointer"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Calculates accurate 24-hour expiration flags and date cutoffs.
            </span>
          </div>

          {/* Default Rows Per Page */}
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="font-label-md text-label-md text-on-surface font-medium">
              Default Rows Per Page
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-surface-container-low rounded-lg max-w-xs border border-outline-variant/30">
              {[20, 50, 100].map((rows) => (
                <button
                  key={rows}
                  type="button"
                  onClick={() => onChange({ rowsPerPage: rows })}
                  className={`py-1.5 text-center font-label-md text-label-md rounded transition-colors cursor-pointer ${
                    settings.rowsPerPage === rows
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-micro'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  {rows}
                </button>
              ))}
            </div>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Table pagination density across all workspace views.
            </span>
          </div>
        </div>

        <div className="mt-unit-lg pt-unit-md border-t border-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save General Settings'}
          </button>
        </div>
      </div>
    </section>
  );
};
