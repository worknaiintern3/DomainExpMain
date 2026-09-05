import React from 'react';
import { Link } from 'react-router-dom';

export const AccountsTopologyBanner: React.FC = () => {
  return (
    <div className="bg-surface-container-low p-unit-lg rounded-xl flex flex-col md:flex-row items-center justify-between gap-unit-md border border-outline-variant/30">
      <div className="flex items-center gap-unit-md">
        <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0 border border-outline-variant/20">
          <span className="material-symbols-outlined text-[24px]">account_tree</span>
        </div>
        <div>
          <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Looking for Asset-to-Server topology?
          </h4>
          <p className="font-body-md text-body-md text-secondary">
            View the complete relationship graph connecting registrars, nameservers, reverse proxies, and VPS instances in the Interactive Infrastructure Map.
          </p>
        </div>
      </div>
      <Link
        to="/infrastructure-map"
        className="shrink-0 h-9 px-unit-md rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-unit-xs transition-colors shadow-sm border border-outline-variant/30"
      >
        <span>Open Infrastructure Map</span>
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </Link>
    </div>
  );
};
