import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  // Base ESLint recommended config
  eslint.configs.recommended,
  
  // TypeScript ESLint config
  {
    files: ['**/*.ts'],
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      'coverage/**',
      '**/*.js'
    ],    
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        console: 'readonly',
        process: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'warn'
    }
  },
  
  // Prettier config (must be last)
  prettier
];