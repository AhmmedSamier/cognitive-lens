import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/target/**',
      '**/bin/**',
      '**/obj/**',
      '**/*.wasm',
      '**/*.vsix',
      '**/cognitive-complexity-report.html',
      'packages/zed-extension/server.js',
      'packages/visual-studio-extension/Resources/server.js',
      '.vscode/**',
      '.vs/**',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  sonarjs.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.builtin,
      },
    },
  },
  {
    rules: {
      'sonarjs/cognitive-complexity': ['error', 15],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/esbuild.js', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'sonarjs/no-os-command-from-path': 'off',
    },
  },
);
