export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'UPCOMING' | 'RESOLVED' | 'INFO';

export type AlertEntityType = 'domain' | 'ssl' | 'dns' | 'server' | 'website' | 'account';

export type AlertType =
  | 'Domain Expiry'
  | 'Auto-Renew'
  | 'SSL Certificate'
  | 'DNSSEC Alert'
  | 'Server Renewal'
  | 'Unmapped Asset'
  | 'Website Warning'
  | 'Upcoming Renewal';

export type AlertStatus = 'unread' | 'read' | 'acknowledged' | 'resolved' | 'dismissed';

export type AlertViewMode = 'feed' | 'matrix' | 'coverage' | 'rules' | 'empty';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  entityType: AlertEntityType;
  type: AlertType;
  domain: string;
  title: string;
  riskInsight: string;
  advisory: string;
  triggeredDate: string;
  dueDate: string;
  daysRemaining: number;
  daysRemainingLabel: string;
  status: AlertStatus;
  registrarOrProvider: string;
  renewalPriceFormatted?: string;
  autoRenewStatus?: string;
  autoRenewIsRisk?: boolean;
  nameservers?: string;
  sslStatus?: string;
  ipAddress?: string;
  targetRoute: string;
  isCriticalActionCard?: boolean;
  isUrgent?: boolean;
  dataSourceNote?: string;
}

export interface AlertSummaryMetrics {
  criticalCount: number;
  warningCount: number;
  upcomingCount: number;
  resolvedCount: number;
  unreadCount: number;
  trackedDomainsCount: number;
  notificationDeliveryStatus: string;
}

export interface HealthMatrixItem {
  id: string;
  domain: string;
  sslHealth: string;
  dnsStatus: string;
  autoRenewStatus: string;
  autoRenewIsRisk?: boolean;
  daysRemaining: number;
  daysRemainingLabel: string;
  overallHealth: 'Critical' | 'Warning' | 'Healthy';
  overallHealthVariant: 'error' | 'warning' | 'primary' | 'neutral';
  targetRoute: string;
}

export interface MonitoringCoverageItem {
  id: string;
  assetType: string;
  icon: string;
  inventoryCount: number;
  inventoryStatus: string;
  monitoringStatus: 'Not Connected' | 'Reference Snapshot' | 'Calculated From Dates' | 'Configuration Only';
  monitoringStatusLabel: string;
  details: string;
  badgeVariant: 'neutral' | 'warning' | 'primary' | 'error';
}

export interface AlertRuleItem {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: AlertSeverity;
  thresholdDays: number;
  thresholdOptions: number[];
  enabled: boolean;
  deliveryChannelHint: string;
}

export interface RenewalHorizonItem {
  id: string;
  label: string;
  domainsCount: number;
  estimatedCostFormatted: string;
  severity: 'error' | 'warning' | 'neutral' | 'primary';
  progressPercent: number;
}
