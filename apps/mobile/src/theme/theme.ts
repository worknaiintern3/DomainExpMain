import { colors } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';

export interface ThemeConfig {
  primaryColor?: string | null | undefined;
  secondaryColor?: string | null | undefined;
}

export function createTheme(remoteTheme?: ThemeConfig | undefined) {
  const dynamicPrimary = remoteTheme?.primaryColor || colors.neonCyan;
  const dynamicSecondary = remoteTheme?.secondaryColor || colors.bgSurface;

  return {
    colors: {
      ...colors,
      primary: dynamicPrimary,
      surfaceSecondary: dynamicSecondary,
    },
    typography,
    spacing,
    radius,
  };
}

export const defaultTheme = createTheme();
export type Theme = ReturnType<typeof createTheme>;
