import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier'
import footerButtonGroupRule from './eslint-rules/footer-button-group.js'
import warnFileLineCountRule from './eslint-rules/warn-file-line-count.js'

const compat = new FlatCompat()
const localPlugin = {
    rules: {
        'footer-button-group': footerButtonGroupRule,
        'warn-file-line-count': warnFileLineCountRule,
    },
}

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
        plugins: {
            local: localPlugin,
        },
        languageOptions: {
            globals: {
                APP_VERSION: 'readonly',
            },
        },
        rules: {
            'max-lines': [
                'error',
                {
                    max: 700,
                    skipBlankLines: true,
                    skipComments: true,
                },
            ],
            'local/warn-file-line-count': 'warn',
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
