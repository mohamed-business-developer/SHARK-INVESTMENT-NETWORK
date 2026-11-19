import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared strict TypeScript rules applied across every workspace package and app.
 */
export const strictTypeScriptRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    {
      prefer: 'type-imports',
      fixStyle: 'inline-type-imports',
    },
  ],
};

/**
 * Import boundary rules for shared packages (must never depend on apps/*, supabase/*, React Native, or Next.js).
 */
export const sharedPackageBoundaryRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['**/apps/*', '**/supabase/*', '@shark/mobile', '@shark/admin'],
          message: 'Shared packages cannot import from apps or supabase.',
        },
      ],
      paths: [
        { name: 'react-native', message: 'Shared packages must remain framework-agnostic.' },
        { name: 'expo', message: 'Shared packages must remain framework-agnostic.' },
        { name: 'next', message: 'Shared packages must remain framework-agnostic.' },
        { name: 'next/server', message: 'Shared packages must remain framework-agnostic.' },
      ],
    },
  ],
};

/**
 * Default ignores shared across flat ESLint configs.
 */
export const defaultIgnores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/.expo/**',
  '**/build/**',
  '**/coverage/**',
  '**/next-env.d.ts',
  '**/expo-env.d.ts',
];

/**
 * Base ESLint flat config for pure TypeScript workspace packages and tests.
 */
export function createBaseConfig(options = {}) {
  const { isSharedPackage = false, extraIgnores = [] } = options;

  return [
    { ignores: [...defaultIgnores, ...extraIgnores] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
          ...globals.es2022,
          ...globals.node,
        },
      },
      rules: {
        ...strictTypeScriptRules,
        ...(isSharedPackage ? sharedPackageBoundaryRules : {}),
      },
    },
  ];
}

export default createBaseConfig;
