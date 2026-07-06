import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier'
import footerButtonGroupRule from './eslint-rules/footer-button-group.js'

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
    {
        files: ['**/*.vue'],
        plugins: {
            local: {
                rules: {
                    'footer-button-group': footerButtonGroupRule,
                },
            },
        },
        rules: {
            'local/footer-button-group': 'error',
            'vue/no-restricted-html-elements': [
                'error',
                {
                    element: 'button',
                    message:
                        'Use <BasicButton> from @/basic/Button.vue instead of raw <button>.',
                },
            ],
        },
    },
    {
        files: [
            'src/basic/**/*.vue',
            'src/components/**/Button.vue',
        ],
        rules: {
            'vue/no-restricted-html-elements': 'off',
        },
    },
]
