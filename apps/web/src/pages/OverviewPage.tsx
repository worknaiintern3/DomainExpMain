import React from 'react';
import { OVERVIEW_REFERENCE_DATA } from '@/features/overview/overview.reference';
import { PortfolioSummaryToolbar } from '@/features/overview/components/PortfolioSummaryToolbar';
import { OverviewMetricCards } from '@/features/overview/components/OverviewMetricCards';
import { RenewalAttentionBanner } from '@/features/overview/components/RenewalAttentionBanner';
import { PortfolioHealthMatrix } from '@/features/overview/components/PortfolioHealthMatrix';
import { UpcomingRenewalsTable } from '@/features/overview/components/UpcomingRenewalsTable';
import { RenewalForecastChart } from '@/features/overview/components/RenewalForecastChart';
import { TldCompositionCard } from '@/features/overview/components/TldCompositionCard';
import { RegistrarDiversityCard } from '@/features/overview/components/RegistrarDiversityCard';

export const OverviewPage: React.FC = () => {
  const data = OVERVIEW_REFERENCE_DATA;

  return (
    <div className="flex flex-col w-full gap-unit-md">
      {/* Overview Page Heading & Subtitle */}
      <div className="flex flex-col">
        <h1 className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-tight">
          Good afternoon, Aman
        </h1>
        <p className="font-caption-xs text-caption-xs text-secondary mt-0.5">
          Here’s what’s happening with your domain portfolio.
        </p>
      </div>

      {/* 1. Operational Summary Toolbar */}
      <PortfolioSummaryToolbar />

      {/* 2. 4 Primary Metric Cards */}
      <OverviewMetricCards metrics={data.metrics} />

      {/* 3. Urgent Attention / Loss Prevention Banner */}
      <RenewalAttentionBanner data={data.urgentAttention} />

      {/* 4. Portfolio Health Segmented Bar */}
      <PortfolioHealthMatrix data={data.healthMatrix} />

      {/* 5. Main Data Grid: Upcoming Renewals Table */}
      <UpcomingRenewalsTable renewals={data.renewals} />

      {/* 6. Bottom Analytics Triplet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-unit-md">
        <RenewalForecastChart data={data.forecast} />
        <TldCompositionCard data={data.tldComposition} />
        <RegistrarDiversityCard data={data.registrarDiversity} />
      </div>
    </div>
  );
};
