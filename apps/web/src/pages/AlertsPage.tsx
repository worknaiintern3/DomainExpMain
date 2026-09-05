import React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { MetricCard } from '@/components/common/MetricCard';

export const AlertsPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="Alerts &amp; Monitoring"
        badge="Notifications"
        description="Monitor impending domain expirations, auto-renew risks, SSL certificate renewals, and DNSSEC validation alerts."
        actions={
          <>
            <Button variant="secondary" size="md" iconLeading="calendar_month">
              Export .ICS Calendar
            </Button>
            <Button variant="primary" size="md" iconLeading="tune">
              Alert Rules
            </Button>
          </>
        }
      />

      {/* Severity Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-unit-md">
        <MetricCard title="Critical" value="2" subtext="Require action" highlight="error" icon="error" />
        <MetricCard title="Warning" value="6" subtext="12-29d window" highlight="warning" icon="warning" />
        <MetricCard title="Upcoming" value="11" subtext="Scheduled" icon="schedule" />
        <MetricCard title="Resolved" value="18" subtext="Past 30d" icon="check_circle" />
        <MetricCard title="Unread" value="7" subtext="Pending review" highlight="primary" icon="mark_chat_unread" />
        <MetricCard title="Tracked" value="42" subtext="Portfolio records" icon="dns" />
      </div>

      {/* Alerts Feed Placeholder */}
      <div className="p-unit-xl rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary mb-unit-sm">
          <span className="material-symbols-outlined text-[28px]">notifications_active</span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Alerts &amp; Expiry Monitoring Center
        </h3>
        <p className="font-body-sm text-body-sm text-secondary max-w-md mt-unit-xs">
          Centralized timeline for renewal countdowns, security events, auto-renew status alerts, and portfolio calendar feeds.
        </p>
      </div>
    </div>
  );
};
