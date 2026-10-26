import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--c-background) / <alpha-value>)',
        'on-background': 'rgb(var(--c-on-background) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'on-surface': 'rgb(var(--c-on-surface) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--c-on-surface-variant) / <alpha-value>)',
        'surface-dim': 'rgb(var(--c-surface-dim) / <alpha-value>)',
        'surface-bright': 'rgb(var(--c-surface-bright) / <alpha-value>)',
        'surface-variant': 'rgb(var(--c-surface-variant) / <alpha-value>)',
        'surface-container-lowest': 'rgb(var(--c-surface-container-lowest) / <alpha-value>)',
        'surface-container-low': 'rgb(var(--c-surface-container-low) / <alpha-value>)',
        'surface-container': 'rgb(var(--c-surface-container) / <alpha-value>)',
        'surface-container-high': 'rgb(var(--c-surface-container-high) / <alpha-value>)',
        'surface-container-highest': 'rgb(var(--c-surface-container-highest) / <alpha-value>)',
        
        // Structural chrome / Toast and Modal Backdrops
        'inverse-surface': 'rgb(var(--c-inverse-surface) / <alpha-value>)',
        'inverse-on-surface': 'rgb(var(--c-inverse-on-surface) / <alpha-value>)',
        
        // Primary - Electric Indigo
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        'on-primary': 'rgb(var(--c-on-primary) / <alpha-value>)',
        'primary-container': 'rgb(var(--c-primary-container) / <alpha-value>)',
        'on-primary-container': 'rgb(var(--c-on-primary-container) / <alpha-value>)',
        'inverse-primary': 'rgb(var(--c-inverse-primary) / <alpha-value>)',
        'primary-fixed': 'rgb(var(--c-primary-fixed) / <alpha-value>)',
        'primary-fixed-dim': 'rgb(var(--c-primary-fixed-dim) / <alpha-value>)',
        'on-primary-fixed': 'rgb(var(--c-on-primary-fixed) / <alpha-value>)',
        'on-primary-fixed-variant': 'rgb(var(--c-on-primary-fixed-variant) / <alpha-value>)',
        
        // Secondary - Slate / Blue-gray
        secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
        'on-secondary': 'rgb(var(--c-on-secondary) / <alpha-value>)',
        'secondary-container': 'rgb(var(--c-secondary-container) / <alpha-value>)',
        'on-secondary-container': 'rgb(var(--c-on-secondary-container) / <alpha-value>)',
        'secondary-fixed': 'rgb(var(--c-secondary-fixed) / <alpha-value>)',
        'secondary-fixed-dim': 'rgb(var(--c-secondary-fixed-dim) / <alpha-value>)',
        'on-secondary-fixed': 'rgb(var(--c-on-secondary-fixed) / <alpha-value>)',
        'on-secondary-fixed-variant': 'rgb(var(--c-on-secondary-fixed-variant) / <alpha-value>)',
        
        // Tertiary - Deep Blue
        tertiary: 'rgb(var(--c-tertiary) / <alpha-value>)',
        'on-tertiary': 'rgb(var(--c-on-tertiary) / <alpha-value>)',
        'tertiary-container': 'rgb(var(--c-tertiary-container) / <alpha-value>)',
        'on-tertiary-container': 'rgb(var(--c-on-tertiary-container) / <alpha-value>)',
        'tertiary-fixed': 'rgb(var(--c-tertiary-fixed) / <alpha-value>)',
        'tertiary-fixed-dim': 'rgb(var(--c-tertiary-fixed-dim) / <alpha-value>)',
        'on-tertiary-fixed': 'rgb(var(--c-on-tertiary-fixed) / <alpha-value>)',
        'on-tertiary-fixed-variant': 'rgb(var(--c-on-tertiary-fixed-variant) / <alpha-value>)',
        
        // Semantic Alerts & Status
        error: 'rgb(var(--c-error) / <alpha-value>)',
        'on-error': 'rgb(var(--c-on-error) / <alpha-value>)',
        'error-container': 'rgb(var(--c-error-container) / <alpha-value>)',
        'on-error-container': 'rgb(var(--c-on-error-container) / <alpha-value>)',
        
        // Status Accents
        healthy: 'rgb(var(--c-healthy) / <alpha-value>)',
        'healthy-bg': 'rgb(var(--c-healthy-bg) / <alpha-value>)',
        'healthy-text': 'rgb(var(--c-healthy-text) / <alpha-value>)',
        'healthy-border': 'rgb(var(--c-healthy-border) / <alpha-value>)',
        
        // Status Accents (Warning & Critical)
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        'warning-bg': 'rgb(var(--c-warning-bg) / <alpha-value>)',
        'warning-text': 'rgb(var(--c-warning-text) / <alpha-value>)',
        'warning-border': 'rgb(var(--c-warning-border) / <alpha-value>)',
        
        critical: 'rgb(var(--c-critical) / <alpha-value>)',
        'critical-bg': 'rgb(var(--c-critical-bg) / <alpha-value>)',
        'critical-text': 'rgb(var(--c-critical-text) / <alpha-value>)',
        'critical-border': 'rgb(var(--c-critical-border) / <alpha-value>)',
        
        // Outlines & Borders
        outline: 'rgb(var(--c-outline) / <alpha-value>)',
        'outline-variant': 'rgb(var(--c-outline-variant) / <alpha-value>)',
        'surface-tint': 'rgb(var(--c-surface-tint) / <alpha-value>)',
      },
      spacing: {
        'sidebar-width': '16rem',
        'header-height': '3.5rem',
        'unit-2xs': '0.125rem',
        'unit-xs': '0.25rem',
        'unit-sm': '0.5rem',
        'unit-md': '0.75rem',
        'unit-base': '1rem',
        'unit-lg': '1.5rem',
        'unit-xl': '2rem',
        'unit-2xl': '3rem',
        'gutter-table': '0.75rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        body: ['Inter', 'sans-serif'],
        'label-mono': ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'display-lg': ['36px', { lineHeight: '44px', letterSpacing: '-0.025em', fontWeight: '600' }],
        'display-lg-mobile': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '26px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', letterSpacing: '0em', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', letterSpacing: '0.005em', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-mono': ['12px', { lineHeight: '16px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'caption-xs': ['11px', { lineHeight: '14px', letterSpacing: '0.02em', fontWeight: '500' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      boxShadow: {
        micro: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        subtle: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        modal: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        dropdown: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
