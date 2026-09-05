import React from 'react';
import { DomainDetailData } from '../domainDetails.types';

interface RegistrationDetailsProps {
  data: DomainDetailData;
}

export const RegistrationDetails: React.FC<RegistrationDetailsProps> = ({ data }) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-sm border border-outline-variant/30">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-unit-sm mb-unit-md bg-surface-container-low/40 p-unit-sm rounded-lg border border-outline-variant/20">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Registration &amp; Registrar Details
          </h2>
        </div>
        <span className="px-unit-sm py-unit-2xs rounded bg-[#ecfdf5] text-[#065f46] font-caption-xs text-caption-xs font-semibold">
          RDAP Data Available
        </span>
      </div>

      {/* 2-Column Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
        {/* Accredited Registrar */}
        <div className="flex flex-col gap-unit-xs bg-surface-container-low p-unit-md rounded-lg border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
            Accredited Registrar
          </span>
          <div className="flex items-center justify-between">
            <span className="font-body-md text-body-md font-semibold text-on-surface">
              {data.registrarName}
            </span>
            <span className="font-label-mono text-label-mono text-caption-xs text-secondary">
              IANA ID: {data.ianaId}
            </span>
          </div>
          <p className="font-caption-xs text-caption-xs text-on-surface-variant mt-1">
            Referral URL:{' '}
            <a
              href={data.referralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {data.referralUrl}
            </a>{' '}
            • Abuse: {data.abuseEmail}
          </p>
        </div>

        {/* Lifecycle Timestamps */}
        <div className="flex flex-col gap-unit-xs bg-surface-container-low p-unit-md rounded-lg border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
            Lifecycle Timestamps
          </span>
          <div className="flex flex-col gap-1 text-on-surface font-body-sm text-body-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Created On:</span>
              <span className="font-label-mono text-label-mono">{data.createdUtc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Updated On:</span>
              <span className="font-label-mono text-label-mono">{data.updatedUtc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Expires On:</span>
              <span className="font-label-mono text-label-mono font-semibold text-primary">
                {data.expiresUtc}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Registry EPP Status Codes */}
      <div className="mt-unit-md">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold block mb-unit-xs">
          Domain Status EPP Codes
        </span>
        <div className="flex flex-wrap gap-unit-xs">
          {data.eppStatusCodes.map((code) => (
            <div
              key={code}
              className="flex items-center gap-1.5 px-unit-sm py-1 bg-surface-container rounded text-on-surface font-label-mono text-label-mono text-[11px] border border-outline-variant/20"
            >
              <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span>
              <span>{code}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Registrant Identity Callout */}
      <div className="mt-unit-md p-unit-sm bg-surface-container-low rounded-lg flex items-start gap-unit-sm border border-outline-variant/20">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
          info
        </span>
        <div className="flex flex-col">
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            Registrant Identity &amp; Privacy Redaction
          </span>
          <p className="font-caption-xs text-caption-xs text-on-surface-variant mt-0.5 leading-relaxed">
            Registration Account Email:{' '}
            <strong className="text-on-surface font-label-mono">{data.registrantEmail}</strong>{' '}
            (Source: User Mapped / RDAP Privacy Protected). Public Registry WHOIS utilizes Domains By
            Proxy, LLC redaction per ICANN Temporary Specification &amp; GDPR directives.
          </p>
        </div>
      </div>
    </div>
  );
};
