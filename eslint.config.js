import globals from 'globals'

import pluginJs from '@eslint/js'
import pluginImport from 'eslint-plugin-import'
import pluginTs from 'typescript-eslint'

export default [
  {files: ['**/*.{js,mjs,cjs,ts}']},
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  pluginJs.configs.recommended,
  ...pluginTs.configs.recommended,
  pluginImport.flatConfigs.recommended,
  pluginImport.flatConfigs.typescript,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
      }],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      'no-debugger': 'error',
      'no-empty': 'off',
      'no-new-wrappers': 'error',
      'no-prototype-builtins': 'off',
      'no-shadow-restricted-names': 'error',
      'no-throw-literal': 'error',
      'no-unsafe-optional-chaining': 'off',
      'no-useless-escape': 'off',

      'import/export': 'error',
      'import/no-absolute-path': 'error',
      'import/no-cycle': 'off',
      'import/no-duplicates': 'off',
      'import/no-empty-named-blocks': 'error',
      'import/no-named-as-default': 'off',
      'import/no-self-import': 'error',
      'import/no-unresolved': 'off',
      'import/no-useless-path-segments': 'error',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {ignores: ['dist/*', '**/dist/*', 'build/*', 'coverage/*', 'node_modules/*']},
]
