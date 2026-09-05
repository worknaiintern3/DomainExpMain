/**
 * Minimal navigation and UI foundation types for Phase 1.
 */

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  badge?: string | number;
  exact?: boolean;
}

export type StatusVariant = 'healthy' | 'warning' | 'critical' | 'neutral' | 'info';

export type ProvenanceVariant = 
  | 'RDAP Retrieved' 
  | 'DNS Retrieved' 
  | 'SSL Retrieved' 
  | 'User Mapped' 
  | 'Stored Record' 
  | 'Reference Dataset';
