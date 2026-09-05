import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProvenanceBadge } from '@/components/common/ProvenanceBadge';

export const WebsiteDetailPage: React.FC = () => {
  const { websiteId } = useParams<{ websiteId: string }>();
  const activeApp = websiteId || 'worknai-website';

  return (
    <div className="flex flex-col gap-unit-lg">
      <div className="flex items-center gap-unit-xs text-caption-xs font-caption-xs text-secondary">
        <Link to="/websites" className="hover:text-primary transition-colors">
          Websites &amp; Apps
        </Link>
        <span>/</span>
        <span className="font-mono text-on-surface font-medium">{activeApp}</span>
      </div>

      <PageHeader
        title="WorknAi Website"
        badge="Production WebApp"
        description="Application runtime metadata, reverse proxy configuration, upstream DNS, server node bindings, and SSL certificate telemetry."
        actions={
          <>
            <Link to="/websites">
              <Button variant="secondary" size="md" iconLeading="arrow_back">
                Back to Apps
              </Button>
            </Link>
            <Button variant="primary" size="md" iconLeading="open_in_new">
              Open Website
            </Button>
          </>
        }
      />

      {/* Ribbon Specs */}
      <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-wrap items-center justify-between gap-unit-sm">
        <div className="flex items-center gap-unit-sm flex-wrap">
          <StatusBadge status="healthy" label="Production" />
          <StatusBadge status="info" label="Next.js 14" />
          <ProvenanceBadge source="User Mapped" />
          <ProvenanceBadge source="SSL Retrieved" />
        </div>
        <span className="font-mono text-caption-xs text-secondary">
          App ID: {activeApp}
        </span>
      </div>

      {/* App Relationship Hierarchy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-md">
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">
            Primary Domain
          </span>
          <span className="font-mono text-body-md font-bold text-on-surface">worknai.com</span>
          <span className="font-caption-xs text-caption-xs text-secondary">Cloudflare Proxied</span>
        </div>
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">
            Target Host Server
          </span>
          <span className="font-body-md font-bold text-on-surface">Production VPS 01</span>
          <span className="font-mono text-caption-xs text-secondary">103.21.58.112 (Hostinger)</span>
        </div>
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase font-medium">
            Runtime Upstream
          </span>
          <span className="font-mono text-body-md font-bold text-primary">127.0.0.1:3000</span>
          <span className="font-caption-xs text-caption-xs text-secondary">Nginx Reverse Proxy • PM2</span>
        </div>
      </div>
    </div>
  );
};
