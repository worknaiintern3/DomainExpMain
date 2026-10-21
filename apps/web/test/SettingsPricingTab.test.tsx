import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PricingTab } from '@/features/settings/components/tabs/PricingTab';
import { DEFAULT_SETTINGS, WORKSPACE_SUMMARY_DATA } from '@/features/settings/settings.reference';

function renderTab() {
  return render(
    <PricingTab
      settings={DEFAULT_SETTINGS.pricing}
      onChange={vi.fn()}
      onSave={vi.fn()}
      isSaving={false}
    />,
  );
}

describe('Settings › Pricing & Currency wording', () => {
  it('states that pricing comes from live registrar APIs', () => {
    renderTab();

    expect(screen.getByText('Pricing Source: Live Registrar APIs')).toBeInTheDocument();
    expect(screen.getByText('Pricing Notice')).toBeInTheDocument();
    expect(
      screen.getByText(/Domain availability and pricing are retrieved from supported registrar APIs/iu),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pricing may be indicative or current depending on the provider/iu),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Purchases, billing, and automatic renewals are handled directly by the registrar/iu,
      ),
    ).toBeInTheDocument();
  });

  it('no longer claims pricing is demo, static, stored or reference data', () => {
    renderTab();

    expect(screen.queryByText(/Pricing Mode/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reference Dataset/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pricing Reference Notice/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/stored\/reference data/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/demo/iu)).not.toBeInTheDocument();
  });

  it('keeps the settings data consistent with live registrar pricing', () => {
    // WORKSPACE_SUMMARY_DATA.pricingMode is displayed in the settings sidebar
    // and the data-management tab.
    expect(WORKSPACE_SUMMARY_DATA.pricingMode).toBe('Live Registrar APIs');
    expect(DEFAULT_SETTINGS.pricing.pricingMode).toBe('live-registrar-apis');
  });
});
