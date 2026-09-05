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
        background: '#f8f9ff',
        'on-background': '#0b1c30',
        surface: '#f8f9ff',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#464555',
        'surface-dim': '#cbdbf5',
        'surface-bright': '#f8f9ff',
        'surface-variant': '#d3e4fe',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'surface-container-high': '#dce9ff',
        'surface-container-highest': '#d3e4fe',
        
        // Structural chrome / Dark Navy Sidebar
        'inverse-surface': '#0b0f19',
        'inverse-on-surface': '#eaf1ff',
        
        // Primary - Electric Indigo
        primary: '#3525cd',
        'on-primary': '#ffffff',
        'primary-container': '#4f46e5',
        'on-primary-container': '#dad7ff',
        'inverse-primary': '#c3c0ff',
        'primary-fixed': '#e2dfff',
        'primary-fixed-dim': '#c3c0ff',
        'on-primary-fixed': '#0f0069',
        'on-primary-fixed-variant': '#3323cc',
        
        // Secondary - Slate / Blue-gray
        secondary: '#565e74',
        'on-secondary': '#ffffff',
        'secondary-container': '#dae2fd',
        'on-secondary-container': '#5c647a',
        'secondary-fixed': '#dae2fd',
        'secondary-fixed-dim': '#bec6e0',
        'on-secondary-fixed': '#131b2e',
        'on-secondary-fixed-variant': '#3f465c',
        
        // Tertiary - Deep Blue
        tertiary: '#004598',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#005cc6',
        'on-tertiary-container': '#cedbff',
        'tertiary-fixed': '#d8e2ff',
        'tertiary-fixed-dim': '#adc6ff',
        'on-tertiary-fixed': '#001a42',
        'on-tertiary-fixed-variant': '#004395',
        
        // Semantic Alerts & Status
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        
        // Status Accents
        healthy: '#10b981',
        'healthy-bg': '#ecfdf5',
        'healthy-text': '#065f46',
        'healthy-border': '#a7f3d0',
        
        warning: '#f59e0b',
        'warning-bg': '#fffbeb',
        'warning-text': '#92400e',
        'warning-border': '#fde68a',
        
        critical: '#ef4444',
        'critical-bg': '#fef2f2',
        'critical-text': '#991b1b',
        'critical-border': '#fecaca',
        
        // Outlines & Borders
        outline: '#777587',
        'outline-variant': '#c7c4d8',
        'surface-tint': '#4d44e3',
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
