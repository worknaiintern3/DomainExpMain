import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'apps/web/**',
      'stitch_domainpulse_saas_dashboard/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: [
      'apps/api/**/*.ts',
      'packages/contracts/**/*.ts',
      'packages/database/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
    },
  },
  {
    files: [
      'apps/api/src/**/*.module.ts',
      'packages/database/src/schema/index.ts',
    ],
    rules: {
      // Nest modules are intentionally decorator-only classes.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
);
