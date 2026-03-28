// ESLint flat config for React Native + TypeScript project
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules (type-aware)
  ...tseslint.configs.recommended,

  // React recommended rules
  {
    plugins: { react: reactPlugin },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
      'react/prop-types': 'off', // Using TypeScript for prop validation
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // React Hooks rules
  {
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: reactHooksPlugin.configs.recommended.rules,
  },

  // Prettier — disables formatting rules that conflict
  prettierConfig,

  // Project-specific overrides
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // Flag but don't block on `any` usage
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off', // Allow require() for RN assets
      'no-console': ['warn', { allow: ['warn', 'error'] }], // Allow console.warn/error
    },
  },

  // Ignore build artifacts and generated files
  {
    ignores: [
      'android/**',
      'ios/**',
      'build/**',
      'app/build/**',
      'node_modules/**',
      '.expo/**',
      '*.config.js',
      '*.config.mjs',
    ],
  },
);
