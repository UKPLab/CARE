import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier'

const compat = new FlatCompat()

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'build/**'],
    },
    ...compat.env({
        browser: true,
        node: true,
        es2021: true,
    }),
    js.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    eslintConfigPrettier,
    {
        languageOptions: {
            globals: {
                APP_VERSION: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': [
                'error',
                {
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_error$',
                    destructuredArrayIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'CatchClause[param=null]',
                    message: 'Always name caught errors `_error`.',
                },
            ],
        },
    },
]
