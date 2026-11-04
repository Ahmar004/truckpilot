import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'dist-ssr', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strict,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      // Icons come from one wrapper file, so swapping the provider is a one-file change.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@phosphor-icons/*'],
              message: 'Import icons from components/ui/icons (or plannerIcons) instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/ui/icons.ts', 'src/components/ui/plannerIcons.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
])
