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
        slate: {
          950: '#0B0F19',
          900: '#0F172A',
          850: '#151F32',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
          50: '#F8FAFC',
        },
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          light: '#3B82F6',
          dark: '#1E40AF',
        },
      },
    },
  },
  plugins: [],
};

export default config;
