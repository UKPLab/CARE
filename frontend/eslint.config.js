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
        rules: {
            'no-unused-vars': [
                'error',
                {
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
]
