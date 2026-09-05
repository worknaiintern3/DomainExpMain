import React from 'react';
import { Link } from 'react-router-dom';
import { UrgentAttentionData } from '../overview.types';

interface RenewalAttentionBannerProps {
  data: UrgentAttentionData;
}

export const RenewalAttentionBanner: React.FC<RenewalAttentionBannerProps> = ({ data }) => {
  return (
    <div className="bg-error-container/40 p-unit-md rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-unit-md border border-error-container">
      <div className="flex items-center gap-unit-md min-w-0">
        <div className="w-8 h-8 rounded-lg bg-error flex items-center justify-center shrink-0 shadow-sm">
          <span className="material-symbols-outlined text-on-error text-[18px]">priority_high</span>
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-unit-xs flex-wrap">
            <span className="font-headline-sm text-headline-sm text-on-error-container text-[15px] font-semibold">
              {data.title}
            </span>
            <span className="font-caption-xs text-caption-xs bg-error text-on-error px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
              {data.badge}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">
            {data.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-unit-sm flex-wrap shrink-0">
        {data.urgentDomains.map((domainItem) => (
          <Link
            key={domainItem.id}
            to={`/domains/${domainItem.domain}`}
            className="flex items-center gap-unit-xs bg-surface-container-lowest px-unit-sm py-1 rounded-lg shadow-sm hover:ring-1 hover:ring-error transition-all"
          >
            <span className="font-label-mono text-label-mono text-on-surface font-semibold">
              {domainItem.domain}
            </span>
            <span className="font-caption-xs text-caption-xs bg-error-container text-on-error-container px-1 py-0.5 rounded font-medium">
              {domainItem.daysRemaining}d left
            </span>
          </Link>
        ))}
        <Link
          to="/domains"
          className="h-8 px-unit-md rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md flex items-center gap-unit-xs shadow-sm transition-all hover:scale-[1.02]"
        >
          <span>Review Renewals</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
};
