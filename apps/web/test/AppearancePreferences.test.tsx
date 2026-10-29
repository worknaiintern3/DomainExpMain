import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarItem } from '@/components/layout/SidebarItem';
import {
  applyAppearancePreferences,
  defaultAppearancePreferences,
  loadAppearancePreferences,
  motionReducedFor,
  resolveSidebarCollapsed,
  saveAppearancePreferences,
  setSidebarManuallyCollapsed,
  readSidebarManuallyCollapsed,
} from '@/lib/appearance';
import { DEFAULT_SETTINGS } from '@/features/settings/settings.reference';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-density');
  document.documentElement.removeAttribute('data-table-density');
  document.documentElement.removeAttribute('data-motion');
  document.documentElement.removeAttribute('data-sidebar');
  vi.unstubAllGlobals();
});

describe('appearance preferences', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(loadAppearancePreferences()).toEqual({
      ...DEFAULT_SETTINGS.appearance,
      theme: DEFAULT_SETTINGS.appearance.theme,
    });
  });

  it('round-trips through localStorage without the theme key', () => {
    saveAppearancePreferences({
      ...defaultAppearancePreferences(),
      density: 'comfortable',
      sidebar: 'collapsed',
      tableRowDensity: 'standard',
      microInteractions: false,
    });

    const loaded = loadAppearancePreferences();
    expect(loaded.density).toBe('comfortable');
    expect(loaded.sidebar).toBe('collapsed');
    expect(loaded.tableRowDensity).toBe('standard');
    expect(loaded.microInteractions).toBe(false);
  });

  it('applies data attributes to <html>', () => {
    applyAppearancePreferences({
      ...defaultAppearancePreferences(),
      density: 'comfortable',
      tableRowDensity: 'standard',
      microInteractions: false,
    });

    expect(document.documentElement.dataset.density).toBe('comfortable');
    expect(document.documentElement.dataset.tableDensity).toBe('standard');
    expect(document.documentElement.dataset.motion).toBe('reduced');
  });

  it('resolves the sidebar rail mode', () => {
    expect(resolveSidebarCollapsed({ sidebar: 'expanded' })).toBe(false);
    expect(resolveSidebarCollapsed({ sidebar: 'collapsed' })).toBe(true);
    expect(resolveSidebarCollapsed({ sidebar: 'remember' }, false)).toBe(false);

    setSidebarManuallyCollapsed(true);
    expect(readSidebarManuallyCollapsed()).toBe(true);
    expect(resolveSidebarCollapsed({ sidebar: 'remember' })).toBe(true);
  });

  it('reduces motion when interactions are off, even without an OS setting', () => {
    expect(
      motionReducedFor({ microInteractions: false, respectReducedMotion: false }),
    ).toBe(true);
    expect(
      motionReducedFor({ microInteractions: true, respectReducedMotion: false }),
    ).toBe(false);
  });

  it('round-trips custom interface and mono fonts through localStorage', () => {
    saveAppearancePreferences({
      ...defaultAppearancePreferences(),
      interfaceFont: 'Outfit',
      monoDataFont: 'Fira Code',
    });

    const loaded = loadAppearancePreferences();
    expect(loaded.interfaceFont).toBe('Outfit');
    expect(loaded.monoDataFont).toBe('Fira Code');
  });

  it('applies font CSS variables and dataset properties on <html>', () => {
    applyAppearancePreferences({
      ...defaultAppearancePreferences(),
      interfaceFont: 'Plus Jakarta Sans',
      monoDataFont: 'Roboto Mono',
    });

    expect(document.documentElement.dataset.interfaceFont).toBe('Plus Jakarta Sans');
    expect(document.documentElement.dataset.monoFont).toBe('Roboto Mono');
    expect(document.documentElement.style.getPropertyValue('--font-interface')).toContain('Plus Jakarta Sans');
    expect(document.documentElement.style.getPropertyValue('--font-mono-data')).toContain('Roboto Mono');
  });
});

describe('SidebarItem collapsed mode', () => {
  const item = { id: 'domains', label: 'My Domains', path: '/domains', icon: 'language' };

  function renderItem(collapsed: boolean) {
    return render(
      <MemoryRouter>
        <SidebarItem item={item} collapsed={collapsed} />
      </MemoryRouter>,
    );
  }

  it('shows the label when expanded', () => {
    renderItem(false);
    expect(screen.getByText('My Domains')).toBeInTheDocument();
  });

  it('hides the label but keeps an accessible name when collapsed', () => {
    renderItem(true);
    expect(screen.queryByText('My Domains')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Domains' })).toBeInTheDocument();
  });
});
