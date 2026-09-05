import React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { MetricCard } from '@/components/common/MetricCard';

export const PricingPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="Price Comparison"
        badge="Registrars &amp; Hosting"
        description="Benchmark first-year registration vs renewal rate hikes, uncover hidden markup fees, and calculate portfolio transfer savings."
        actions={
          <>
            <Button variant="secondary" size="md" iconLeading="calculate">
              Transfer Calculator
            </Button>
            <Button variant="primary" size="md" iconLeading="file_download">
              Export Matrix
            </Button>
          </>
        }
      />

      {/* Comparison Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-unit-md">
        <MetricCard title="Lowest 1st Yr" value="₹699" subtext="Hostinger (.com)" highlight="primary" />
        <MetricCard title="Lowest Renewal" value="₹899" subtext="Cloudflare (At-Cost)" highlight="primary" />
        <MetricCard title="Lowest Transfer" value="₹749" subtext="Porkbun (+1 yr)" />
        <MetricCard title="Providers" value="8" subtext="Registrars compared" />
        <MetricCard title="Industry Avg" value="₹1,249" subtext="Across 8 providers" />
        <MetricCard title="Markup Alert" value="3 of 8" subtext="Hike renewals >80%" highlight="error" />
      </div>

      {/* Pricing Matrix Placeholder */}
      <div className="p-unit-xl rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary mb-unit-sm">
          <span className="material-symbols-outlined text-[28px]">payments</span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Registrar &amp; Hosting Price Comparison Matrix
        </h3>
        <p className="font-body-sm text-body-sm text-secondary max-w-md mt-unit-xs">
          Compare multi-year domain registration pricing, renewal benchmarks, and cloud hosting tiers across verified industry providers.
        </p>
      </div>
    </div>
  );
};
