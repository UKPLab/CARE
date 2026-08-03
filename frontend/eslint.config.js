import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier'
import vueI18n from '@intlify/eslint-plugin-vue-i18n'
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
    ...vueI18n.configs['flat/recommended'],
    {
        plugins: {
            local: localPlugin,
        },
        languageOptions: {
            ecmaVersion: 'latest',
            globals: {
                APP_VERSION: 'readonly',
            },
        },
        settings: {
            'vue-i18n': {
                // Catalogs are checked by scripts/check-i18n-keys.mjs (filename = namespace).
                // localeDir is unused while no-missing-keys is off.
                messageSyntaxVersion: '^9.0.0',
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
            // Templates: ban hardcoded user-facing text.
            '@intlify/vue-i18n/no-raw-text': [
                'error',
                {
                    // Empty, non-Latin, single letter, tiny UI crumbs.
                    ignorePattern: '^$|^([^A-Za-z]+|[A-Za-z]|KB\\)?|\\(ID:)$',
                    ignoreText: ['CARE', 'ID', 'REQ', 'CMD', 'ORCID', 'LDAP', 'SSO', '-'],
                    // CARE uses Vue props heavily (BasicButton text=, Modal title=, etc.).
                    attributes: {
                        '/.+/': [
                            'text',
                            'title',
                            'label',
                            'placeholder',
                            'message',
                            'alt',
                            'submit-text',
                            'next-text',
                            'cancel-next-text',
                            'error-message',
                        ],
                    },
                },
            ],
            // Missing keys: custom script reads utils/modules/i18n/en/*.json.
            '@intlify/vue-i18n/no-missing-keys': 'off',
            '@intlify/vue-i18n/no-unused-keys': 'off',
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
    // Out of scope for i18n lint: setup wizard, Settings mail-test UI,
    // unused submission ReviewUpload/Publish modals (not imported).
    {
        files: [
            'src/auth/SetupWizard.vue',
            'src/components/wizard/**/*.vue',
            'src/components/wizard/**/*.js',
            'src/components/dashboard/Settings.vue',
            'src/components/dashboard/submission/UploadModal.vue',
            'src/components/dashboard/submission/PublishModal.vue',
        ],
        rules: {
            '@intlify/vue-i18n/no-raw-text': 'off',
        },
    },
]
