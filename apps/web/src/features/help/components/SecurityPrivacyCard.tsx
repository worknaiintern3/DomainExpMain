import React from 'react';
import { SECURITY_PRIVACY_DATA } from '../help.reference';

export const SecurityPrivacyCard: React.FC = () => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const landingUrl = env?.['VITE_LANDING_URL']?.replace(/\/$/, '') ?? 'https://app.domainexprt.com';

  return (
    <section id="sec-security" className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-micro border border-outline-variant/30 scroll-mt-20 flex flex-col gap-unit-md">
      <div className="flex items-center gap-2 pb-unit-sm border-b border-surface-container-low">
        <span className="material-symbols-outlined text-[22px] text-primary">
          shield_lock
        </span>
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            {SECURITY_PRIVACY_DATA.headline}
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            {SECURITY_PRIVACY_DATA.summary}
          </p>
        </div>
      </div>

      <div className="p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-unit-sm">
        <span className="font-label-md text-label-md text-on-surface font-semibold">
          {SECURITY_PRIVACY_DATA.demoStatement}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-unit-sm">
          {SECURITY_PRIVACY_DATA.neverCollectedList.map((item, idx) => (
            <div
              key={idx}
              className="p-unit-sm rounded-lg bg-surface-container-lowest border border-error/20 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-error text-[18px] shrink-0">
                block
              </span>
              <span className="font-caption-xs text-caption-xs text-on-surface font-medium">
                {item}
              </span>
            </div>
          ))}
        </div>

        <p className="font-caption-xs text-caption-xs text-secondary mt-1 leading-relaxed">
          {SECURITY_PRIVACY_DATA.clarification}
        </p>
      </div>
      <a className="inline-flex w-fit items-center gap-2 text-label-md font-semibold text-primary underline-offset-2 hover:underline" href={`${landingUrl}/privacy-policy`} rel="noopener noreferrer" target="_blank">
        Read the privacy policy <span aria-hidden="true" className="material-symbols-outlined text-[17px]">open_in_new</span>
      </a>
    </section>
  );
};
