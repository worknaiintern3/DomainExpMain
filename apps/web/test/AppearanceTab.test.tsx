import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppearanceTab } from '@/features/settings/components/tabs/AppearanceTab';
import { AppearanceSettings } from '@/features/settings/settings.types';
import { DEFAULT_SETTINGS } from '@/features/settings/settings.reference';

describe('AppearanceTab component', () => {
  const initialSettings: AppearanceSettings = {
    ...DEFAULT_SETTINGS.appearance,
  };

  function TestWrapper({ onSave = vi.fn(), isSaving = false }: { onSave?: () => void; isSaving?: boolean }) {
    const [settings, setSettings] = useState<AppearanceSettings>(initialSettings);
    return (
      <AppearanceTab
        settings={settings}
        onChange={(updated) => setSettings((prev) => ({ ...prev, ...updated }))}
        onSave={onSave}
        isSaving={isSaving}
      />
    );
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all sections and initial values correctly', () => {
    render(<TestWrapper />);

    expect(screen.getByText('Interface & Appearance')).toBeInTheDocument();
    expect(screen.getByText('Theme Mode')).toBeInTheDocument();
    expect(screen.getByText('Interface Density')).toBeInTheDocument();
    expect(screen.getByText('Sidebar Behavior')).toBeInTheDocument();
    expect(screen.getByText('Table Row Density')).toBeInTheDocument();
    expect(screen.getByText('Interface Font')).toBeInTheDocument();
    expect(screen.getByText('Mono Data Font')).toBeInTheDocument();
    expect(screen.getByText('Typography Live Pairing Preview')).toBeInTheDocument();
    expect(screen.getByText('Micro-Interactions & Transitions')).toBeInTheDocument();
    expect(screen.getByText('Respect Reduced Motion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Appearance Settings' })).toBeInTheDocument();
  });

  it('allows selecting theme modes (Light, Dark, System)', () => {
    render(<TestWrapper />);

    fireEvent.click(screen.getByText('Dark'));
    expect(screen.getByText('Dark Theme')).toBeInTheDocument();

    fireEvent.click(screen.getByText('System Sync'));
    expect(screen.getByText('System Theme')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Light (Concept C)'));
    expect(screen.getByText('Light Theme')).toBeInTheDocument();
  });

  it('allows toggling interface density between Compact and Comfortable', () => {
    render(<TestWrapper />);

    fireEvent.click(screen.getByRole('button', { name: /Comfortable/u }));
    expect(screen.getByText('Comfortable UI')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Compact$/u }));
    expect(screen.getByText('Compact UI')).toBeInTheDocument();
  });

  it('allows toggling sidebar behavior between Expanded, Collapsed, and Remember', () => {
    render(<TestWrapper />);

    fireEvent.click(screen.getByRole('button', { name: /Collapsed/u }));
    expect(screen.getByText('Collapsed Rail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remember/u }));
    expect(screen.getByText('Remember Rail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Expanded/u }));
    expect(screen.getByText('Expanded Rail')).toBeInTheDocument();
  });

  it('allows toggling table row density between Compact and Standard', () => {
    render(<TestWrapper />);

    fireEvent.click(screen.getByRole('button', { name: 'Standard (52px)' }));
    expect(screen.getByRole('button', { name: 'Standard (52px)' })).toHaveClass('shadow-micro');

    fireEvent.click(screen.getByRole('button', { name: 'Compact (44px)' }));
    expect(screen.getByRole('button', { name: 'Compact (44px)' })).toHaveClass('shadow-micro');
  });

  it('allows selecting different interface fonts', () => {
    render(<TestWrapper />);

    fireEvent.click(screen.getByText('Outfit'));
    expect(screen.getByText('Active: Outfit')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Plus Jakarta Sans'));
    expect(screen.getByText('Active: Plus Jakarta Sans')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Roboto'));
    expect(screen.getByText('Active: Roboto')).toBeInTheDocument();

    fireEvent.click(screen.getByText('System Sans'));
    expect(screen.getByText('Active: System Sans')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Inter'));
    expect(screen.getByText('Active: Inter')).toBeInTheDocument();
  });

  it('allows selecting different mono data fonts', () => {
    render(<TestWrapper />);

    fireEvent.click(screen.getByText('Fira Code'));
    expect(screen.getByText('Active: Fira Code')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Roboto Mono'));
    expect(screen.getByText('Active: Roboto Mono')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Source Code Pro'));
    expect(screen.getByText('Active: Source Code Pro')).toBeInTheDocument();

    fireEvent.click(screen.getByText('JetBrains Mono'));
    expect(screen.getByText('Active: JetBrains Mono')).toBeInTheDocument();
  });

  it('allows toggling accessibility switches and saving', () => {
    const handleSave = vi.fn();
    render(<TestWrapper onSave={handleSave} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);

    // Toggle Micro-interactions
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText('Zero-delay Snappy')).toBeInTheDocument();

    // Toggle Reduced Motion
    fireEvent.click(checkboxes[1]);

    // Click Save
    const saveButton = screen.getByRole('button', { name: 'Save Appearance Settings' });
    fireEvent.click(saveButton);
    expect(handleSave).toHaveBeenCalledTimes(1);
  });
});
