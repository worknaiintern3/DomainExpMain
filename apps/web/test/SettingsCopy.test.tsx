import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from '@/pages/SettingsPage';
import { clearRecentSearches } from '@/lib/recentSearches';

const { auth, preferences } = vi.hoisted(() => ({
  auth: { user: { email: 'user@example.test' } },
  // Stable object identity, like the real provider's state: a fresh object per
  // render would re-trigger SettingsPage's load-saved-settings effect forever.
  preferences: {
    general: {
      dateFormat: 'DD MMM YYYY',
      defaultLandingPage: '/overview',
      displayName: 'Test User',
      rowsPerPage: 20,
      timezone: 'Asia/Kolkata',
      workspaceName: 'Acme Portfolio',
    },
    portfolio: {
      autoFetchMetadataOnCreation: true,
      automaticMetadataRefresh: 'on-open',
      criticalThresholdDays: 7,
      defaultAutoRenew: 'unknown',
      metadataSources: { dns: true, http: true, infra: true, rdap: true, tls: true },
      warningThresholdDays: 30,
    },
    discovery: {
      availabilityCheckMode: 'selected',
      defaultCheckedTlds: ['.com'],
      defaultSearchSort: 'availability',
      savedSearchHistory: true,
    },
    reload: vi.fn(() => Promise.resolve()),
    saveDiscovery: vi.fn((_input: { savedSearchHistory: boolean }) => Promise.resolve()),
    saveGeneral: vi.fn(() => Promise.resolve()),
    savePortfolio: vi.fn(() => Promise.resolve()),
    status: 'ready',
  },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/preferences/PreferencesContext', () => ({ usePreferences: () => preferences }));

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

function openTab(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('Settings production-truthfulness copy', () => {
  beforeEach(() => {
    preferences.status = 'ready';
    preferences.reload.mockClear();
    preferences.saveDiscovery.mockClear();
    preferences.saveGeneral.mockClear();
    preferences.savePortfolio.mockClear();
    preferences.saveDiscovery.mockImplementation(async (input) => {
      if (!input.savedSearchHistory) clearRecentSearches();
    });
    localStorage.clear();
  });

  it('shows only real account values in the sidebar card (no hardcoded storage/pricing claims)', () => {
    renderSettings();

    expect(screen.getByText('Signed in as')).toBeInTheDocument();
    expect(screen.getByText('user@example.test')).toBeInTheDocument();
    expect(screen.getAllByText('Acme Portfolio').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pricing Source')).not.toBeInTheDocument();
    expect(screen.queryByText('Not Connected')).not.toBeInTheDocument();
  });

  it('describes domain-only JSON export without a fake dataset reset', () => {
    renderSettings();
    openTab(/Data Management/u);

    expect(screen.getAllByText('Pricing Source')).toHaveLength(1);
    expect(screen.queryByText('Pricing Mode')).not.toBeInTheDocument();
    expect(screen.getByText(/Download a domain-only snapshot/u)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore Default Dataset' })).not.toBeInTheDocument();
    expect(screen.queryByText(/reference benchmark pricing/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reload the initial 42 domain records/iu)).not.toBeInTheDocument();
  });

  it('reset defaults marks real preferences unsaved until Save', async () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /Reset to Defaults/u }));
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/u }));
    await waitFor(() => expect(preferences.saveDiscovery).toHaveBeenCalledOnce());
    expect(preferences.saveGeneral).toHaveBeenCalledOnce();
    expect(preferences.savePortfolio).toHaveBeenCalledOnce();
    expect(localStorage.getItem('domainpulse.pricing-preferences')).toContain('"defaultCurrency":"INR"');
    expect(localStorage.getItem('domainpulse.appearance')).toContain('"density":"compact"');
  });

  it('Domain Discovery shows only real, working controls (no dataset or suggestion claims)', () => {
    renderSettings();
    openTab(/Domain Discovery/u);

    expect(screen.getByText('Default Extensions Scoping')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Selected Extensions Only/ })).toBeInTheDocument();
    expect(screen.getByText('Default Result Ranking & Sorting')).toBeInTheDocument();
    expect(screen.queryByText(/Reference Dataset/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reference Preview/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Suggestion Style/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Source: Live Registrar APIs/iu)).not.toBeInTheDocument();
  });

  it('shows a recoverable error instead of editable defaults when discovery settings fail to load', () => {
    preferences.status = 'error';
    renderSettings();
    openTab(/Domain Discovery/u);

    expect(screen.getByRole('alert')).toHaveTextContent('Your saved account settings could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(preferences.reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Default Extensions')).not.toBeInTheDocument();
  });

  it('top Save persists Pricing and Appearance changes on this device', async () => {
    renderSettings();
    openTab(/Pricing & Currency/u);
    fireEvent.click(screen.getByRole('button', { name: /USD/u }));
    openTab(/Appearance/u);
    fireEvent.click(screen.getByText('Dark'));
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/u }));
    await waitFor(() => expect(localStorage.getItem('domainpulse.theme')).toBe('dark'));
    expect(localStorage.getItem('domainpulse.pricing-preferences')).toContain('"defaultCurrency":"USD"');
    expect(localStorage.getItem('domainpulse.appearance')).toContain('"density":"compact"');
  });

  it('does not pretend to save when nothing changed', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/u }));
    expect(screen.getByText('Nothing to save')).toBeInTheDocument();
    expect(preferences.saveGeneral).not.toHaveBeenCalled();
  });

  it('clears device-local history after saving with history disabled', async () => {
    localStorage.setItem('domainpulse.recent-searches', JSON.stringify(['example']));
    renderSettings();
    openTab(/Domain Discovery/u);

    fireEvent.click(screen.getByRole('checkbox', { name: /Remember Recent Searches/u }));
    fireEvent.click(screen.getByRole('button', { name: /Save Discovery Settings/ }));

    await waitFor(() => expect(preferences.saveDiscovery).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem('domainpulse.recent-searches')).toBeNull());
    expect(screen.getByRole('button', { name: /Clear history/ })).toBeDisabled();
  });

  it('warns before a browser unload while discovery changes are unsaved', () => {
    renderSettings();
    openTab(/Domain Discovery/u);
    fireEvent.click(screen.getByRole('button', { name: /^\.in\s/ }));

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('can cancel internal navigation while discovery changes are unsaved', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSettings();
    openTab(/Domain Discovery/u);
    fireEvent.click(screen.getByRole('button', { name: /^\.in\s/ }));

    const link = document.createElement('a');
    link.href = '/overview';
    link.textContent = 'Leave settings';
    document.body.appendChild(link);
    const allowed = fireEvent.click(link);

    expect(allowed).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      'You have unsaved settings. Leave this page and discard them?',
    );
    link.remove();
    confirm.mockRestore();
  });
});
