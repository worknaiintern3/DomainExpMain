export const Colors = {
  dark: {
    background: '#090d16',
    surface: '#111726',
    surfaceElevated: '#182032',
    surfaceHighlight: '#1f2a42',
    border: '#1e293b',
    borderSubtle: '#172236',
    borderFocus: '#38bdf8',

    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textInverse: '#090d16',

    primary: '#38bdf8', // Sky / Cyan
    primaryHover: '#0ea5e9',
    primaryMuted: 'rgba(56, 189, 248, 0.15)',

    emerald: '#10b981',
    emeraldMuted: 'rgba(16, 185, 129, 0.15)',

    amber: '#f59e0b',
    amberMuted: 'rgba(245, 158, 11, 0.15)',

    rose: '#f43f5e',
    roseMuted: 'rgba(244, 63, 94, 0.15)',

    violet: '#8b5cf6',
    violetMuted: 'rgba(139, 92, 246, 0.15)',

    tabBarBackground: '#0b101d',
    tabBarBorder: '#182238',
    tabBarActive: '#38bdf8',
    tabBarInactive: '#64748b',
  },
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceElevated: '#f1f5f9',
    surfaceHighlight: '#e2e8f0',
    border: '#e2e8f0',
    borderSubtle: '#cbd5e1',
    borderFocus: '#0284c7',

    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    textInverse: '#ffffff',

    primary: '#0284c7', // Sky Blue
    primaryHover: '#0369a1',
    primaryMuted: 'rgba(2, 132, 199, 0.12)',

    emerald: '#059669',
    emeraldMuted: 'rgba(5, 150, 105, 0.12)',

    amber: '#d97706',
    amberMuted: 'rgba(217, 119, 6, 0.12)',

    rose: '#e11d48',
    roseMuted: 'rgba(225, 29, 72, 0.12)',

    violet: '#7c3aed',
    violetMuted: 'rgba(124, 58, 237, 0.12)',

    tabBarBackground: '#ffffff',
    tabBarBorder: '#e2e8f0',
    tabBarActive: '#0284c7',
    tabBarInactive: '#94a3b8',
  },
};

export type ThemeType = 'light' | 'dark';
export type ThemeMode = 'system' | 'light' | 'dark';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

export const Typography = {
  titleLarge: {
    fontSize: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  titleMedium: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  titleSmall: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  bodyLarge: {
    fontSize: 15,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 13,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 11,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 10,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
};
