const js = require('@eslint/js')
const { FlatCompat } = require('@eslint/eslintrc')
const pluginVue = require('eslint-plugin-vue')
const eslintConfigPrettier = require('eslint-config-prettier')

const compat = new FlatCompat()

module.exports = [
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
        },
    },
]
