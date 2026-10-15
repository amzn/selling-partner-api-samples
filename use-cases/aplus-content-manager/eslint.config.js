// ESLint flat config for the whole sample: plain ES modules on the server, TypeScript + React on the client.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', 'client/dist/**', 'docs/**', 'server/mock/**', 'shared/module-catalog.json'],
  },
  // Server and tooling: Node ES modules
  {
    files: ['server/**/*.js', 'eslint.config.js', 'client/vite.config.ts'],
    ...js.configs.recommended,
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } },
    // `const { omitted, ...rest } = obj` is how the mock strips internal fields from a response
    rules: { 'no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }] },
  },
  // Client: TypeScript + React 18 with the new JSX transform (no React import needed)
  ...tseslint.configs.recommended.map((cfg) => ({ ...cfg, files: ['client/src/**/*.{ts,tsx}'] })),
  {
    files: ['client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // This rule prepares code for the React Compiler, which the sample does not use. It flags the plain
      // fetch-in-effect pattern (reset state, fetch, set state, cancel on cleanup) the components rely on.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Turn off formatting rules; Prettier owns formatting
  prettier,
);
