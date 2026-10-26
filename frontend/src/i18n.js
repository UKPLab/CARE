/**
 * Shared vue-i18n instance.
 *
 * Lives in its own module (instead of main.js) so helpers like assets/utils.js
 * can import it without creating a circular import back to main.js → App.vue.
 */
import { createI18n } from 'vue-i18n'
import i18nBundles from '@i18n/i18n-bundles.js'
import { DEFAULT_LOCALE, getInitialLocale } from '@/assets/locale.js'

export const i18n = createI18n({
  legacy: true,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: i18nBundles,
  pluralizationRules: {
    fr: (choice, choicesLength) => (choicesLength === 2 && Math.abs(choice) > 1 ? 1 : 0),
  },
});

export default i18n;
