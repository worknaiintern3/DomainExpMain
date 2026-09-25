/**
 * DomainPulse Premium Neon Dark UI Color System
 * Primary: Very dark blue/black (#020B10, #041218, #06151B)
 * Accents: Cyan -> Turquoise -> Emerald Neon (#00E5FF -> #00F5C8 -> #35F28A)
 */
export const colors = {
  // Backgrounds
  bgPrimary: '#020B10',
  bgSecondary: '#041218',
  bgTertiary: '#06151B',
  bgSurface: '#0B1E28',
  bgCard: '#0D222E',
  bgCardElevated: '#112B3A',
  bgInput: '#081720',

  // Primary Neon Brand Gradient Accents
  neonCyan: '#00E5FF',
  neonTurquoise: '#00F5C8',
  neonGreen: '#35F28A',
  neonAmber: '#FFB800',
  neonCoral: '#FF5C5C',
  neonGlow: 'rgba(0, 229, 255, 0.25)',
  neonGreenGlow: 'rgba(53, 242, 138, 0.25)',

  // Secondary Accents
  sky: '#38BDF8',
  blue: '#2563EB',
  indigo: '#6366F1',

  // Semantic Status Colors
  success: '#10B981',
  successGlow: 'rgba(16, 185, 129, 0.2)',
  warning: '#F59E0B',
  warningGlow: 'rgba(245, 158, 11, 0.2)',
  danger: '#EF4444',
  dangerGlow: 'rgba(239, 68, 68, 0.2)',
  info: '#00E5FF',
  infoGlow: 'rgba(0, 229, 255, 0.2)',

  // Borders
  borderSubtle: 'rgba(100, 180, 220, 0.12)',
  borderNormal: 'rgba(100, 180, 220, 0.2)',
  borderActive: 'rgba(0, 229, 255, 0.45)',
  borderCritical: 'rgba(239, 68, 68, 0.4)',

  // Typography
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDim: '#475569',
  textCyan: '#00E5FF',
  textGreen: '#35F28A',

  // Overlay
  overlay: 'rgba(2, 11, 16, 0.85)',
} as const;

export type ColorName = keyof typeof colors;
