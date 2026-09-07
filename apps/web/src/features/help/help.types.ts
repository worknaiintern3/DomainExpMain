export type HelpCategory =
  | 'quick-start'
  | 'status'
  | 'domain-data'
  | 'features'
  | 'data-sources'
  | 'monitoring'
  | 'security'
  | 'faq'
  | 'troubleshooting'
  | 'limitations';

export interface QuickStartStep {
  step: number;
  title: string;
  description: string;
  targetRoute?: string;
  targetLabel?: string;
  icon: string;
}

export interface StatusExplanationItem {
  badgeLabel: string;
  statusType: 'critical' | 'warning' | 'healthy' | 'neutral' | 'unknown';
  triggerCondition: string;
  recommendedAction: string;
}

export interface DataFieldExplanation {
  name: string;
  category: string;
  protocolTag: string;
  description: string;
}

export interface FeatureGuideItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  summary: string;
  keyPoints: string[];
  targetRoute: string;
  targetLabel: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
}

export interface TroubleshootingItem {
  id: string;
  title: string;
  symptom: string;
  resolution: string;
  commandSnippet?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface DataLimitationItem {
  icon: string;
  text: string;
}

export interface ProductMetadata {
  product: string;
  workspace: string;
  build: string;
  dataSources: string;
  pricing: string;
  monitoring: string;
}
