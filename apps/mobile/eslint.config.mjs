import expoConfig from 'eslint-config-expo/flat.js';
import { defaultIgnores, strictTypeScriptRules } from '@shark/config/eslint.base.mjs';

export default [
  {
    ignores: [...defaultIgnores, 'android/**', 'ios/**', 'babel.config.js', 'metro.config.js'],
  },
  ...expoConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
    rules: {
      ...strictTypeScriptRules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/admin/**', '**/supabase/**', '@shark/admin'],
              message: 'Mobile app cannot import from admin or supabase internals.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Use validated env accessors in src/services/env.ts instead of raw process.env.',
        },
      ],
    },
  },
  {
    files: ['app.config.ts', 'src/services/env.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
];
