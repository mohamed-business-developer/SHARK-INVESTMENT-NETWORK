import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defaultIgnores, strictTypeScriptRules } from '@shark/config/eslint.base.mjs';

export default [
  { ignores: [...defaultIgnores, 'postcss.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...strictTypeScriptRules,
      'react/prop-types': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/apps/mobile/**',
                '**/supabase/functions/**',
                '**/supabase/migrations/**',
                '**/supabase/seeds/**',
                '**/supabase/tests/**',
                '../../**/supabase/**',
                '../../../**/supabase/**',
                'supabase/**',
                '@shark/mobile',
              ],
              message: 'Admin portal cannot import from mobile or supabase internals.',
            },
          ],
        },
      ],
    },
  },
];
