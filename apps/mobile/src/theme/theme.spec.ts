import { describe, expect, it } from 'vitest';
import { colors } from './colors';
import { createTheme, defaultTheme } from './theme';

describe('theme system', () => {
  it('creates default theme with neon dark palette', () => {
    expect(defaultTheme.colors.bgPrimary).toBe('#020B10');
    expect(defaultTheme.colors.neonCyan).toBe('#00E5FF');
    expect(defaultTheme.colors.neonGreen).toBe('#35F28A');
    expect(defaultTheme.colors.primary).toBe(colors.neonCyan);
  });

  it('supports remote config overrides for brand colors', () => {
    const customTheme = createTheme({
      primaryColor: '#FF0055',
      secondaryColor: '#123456',
    });
    expect(customTheme.colors.primary).toBe('#FF0055');
    expect(customTheme.colors.surfaceSecondary).toBe('#123456');
    expect(customTheme.colors.bgPrimary).toBe('#020B10');
  });

  it('provides complete radius and spacing tokens', () => {
    expect(defaultTheme.spacing.md).toBe(12);
    expect(defaultTheme.spacing.lg).toBe(16);
    expect(defaultTheme.radius.lg).toBe(14);
    expect(defaultTheme.radius.full).toBe(9999);
  });
});
