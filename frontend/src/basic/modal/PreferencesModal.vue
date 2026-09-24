<template>
  <BasicModal
    ref="modal"
    size="lg"
    name="PreferencesModal"
    @hide="onHide"
  >
    <template #title>
      <span>{{ $t("auth.preferences.title") }}</span>
    </template>
    <template #body>
      <div
        v-if="!languageSelectionDisabled"
        class="preferences-section mb-4"
      >
        <h6 class="section-title">{{ $t("auth.preferences.sections.language") }}</h6>
        <LanguageSwitcher
          :persist="false"
          class="preferences-language-switcher"
        />
      </div>

      <div
        v-if="consentEnabled"
        class="preferences-section"
      >
        <h6 class="section-title">{{ $t("auth.updateConsent") }}</h6>
        <div
          v-if="requestData"
          class="consent-item"
        >
          <label class="consent-label">
            <input
              v-model="acceptDataSharing"
              class="consent-input"
              type="checkbox"
            />
            {{ $t("auth.acceptDataSharing") }}
          </label>
        </div>
        <div
          v-if="requestStats"
          class="consent-item"
        >
          <label class="consent-label">
            <input
              v-model="acceptStats"
              class="consent-input"
              type="checkbox"
            />
            {{ $t("auth.acceptStatsBehavior") }}
          </label>
        </div>
      </div>
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          :title="$t('common.cancel')"
          class="btn btn-secondary"
          @click="cancel"
        />
        <BasicButton
          :title="$t('common.confirm')"
          class="btn btn-primary"
          @click="confirm"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import LanguageSwitcher from "@/basic/LanguageSwitcher.vue";
import { resolveApiMessage } from "@/assets/utils";
import { clearCachedLocale, getLocaleFromSettings, getStoredLocale, LOCALE_SETTING_KEY, setStoredLocale } from "@/assets/locale.js";

/**
 * User preferences: language and consent settings.
 *
 * @author Andrii Nikitin
 */
export default {
  name: "PreferencesModal",
  components: { BasicModal, BasicButton, LanguageSwitcher },
  data() {
    return {
      acceptStats: false,
      acceptDataSharing: false,
      savedLocale: "en",
      savedAcceptStats: false,
      savedAcceptDataSharing: false,
      confirmed: false,
      /** True if localStorage already had `"locale"` when the modal opened (used by revert()). */
      localeCacheExistedAtOpen: false,
    };
  },
  computed: {
    user() {
      return this.$store.getters["auth/getUser"];
    },
    consentEnabled() {
      return this.$store.getters["settings/getValue"]("app.config.consent.enabled") === "true";
    },
    requestStats() {
      return this.$store.getters["settings/getValue"]("app.register.requestStats") === "true";
    },
    requestData() {
      return this.$store.getters["settings/getValue"]("app.register.requestData") === "true";
    },
    languageSelectionDisabled() {
      return this.$store.getters["auth/isLanguageSelectionDisabled"];
    },
  },
  watch: {
    user: {
      handler(newUser) {
        if (newUser) {
          this.acceptStats = newUser.acceptStats;
          this.acceptDataSharing = newUser.acceptDataSharing;
        }
      },
      immediate: true,
    },
  },
  methods: {
    open() {
      this.confirmed = false;
      this.localeCacheExistedAtOpen = !!getStoredLocale();
      const fromSettings = getLocaleFromSettings(this.$store.getters["settings/getSettings"]);
      this.savedLocale = fromSettings || getStoredLocale() || this.$i18n.locale;
      const user = this.user;
      if (user) {
        this.savedAcceptStats = user.acceptStats;
        this.savedAcceptDataSharing = user.acceptDataSharing;
        this.acceptStats = user.acceptStats;
        this.acceptDataSharing = user.acceptDataSharing;
      }
      this.$refs.modal.open();
    },
    cancel() {
      this.revert();
      this.$refs.modal.close();
    },
    onHide() {
      if (!this.confirmed) {
        this.revert();
      }
    },
    revert() {
      this.$i18n.locale = this.savedLocale;
      if (this.localeCacheExistedAtOpen) {
        setStoredLocale(this.savedLocale);
      } else {
        clearCachedLocale();
      }
      this.acceptStats = this.savedAcceptStats;
      this.acceptDataSharing = this.savedAcceptDataSharing;
    },
    persistLocale() {
      const locale = this.$i18n.locale;
      setStoredLocale(locale);
      this.localeCacheExistedAtOpen = true;
      this.$socket.emit("appSettingSet", { key: LOCALE_SETTING_KEY, value: locale });
    },
    hasLocaleChanged() {
      return this.$i18n.locale !== this.savedLocale;
    },
    hasConsentChanged() {
      return (
        this.acceptStats !== this.savedAcceptStats
        || this.acceptDataSharing !== this.savedAcceptDataSharing
      );
    },
    confirm() {
      const localeChanged = this.hasLocaleChanged();
      const consentChanged = this.consentEnabled && this.hasConsentChanged();

      if (!localeChanged && !consentChanged) {
        this.confirmed = true;
        this.$refs.modal.close();
        return;
      }

      if (localeChanged && !this.languageSelectionDisabled) {
        this.persistLocale();
      }

      if (!consentChanged) {
        this.confirmed = true;
        this.$refs.modal.close();
        return;
      }

      const consentData = {
        acceptTerms: true,
        acceptStats: this.acceptStats,
        acceptDataSharing: this.acceptDataSharing,
      };
      this.$socket.emit("userConsentUpdate", consentData, (res) => {
        if (res.success) {
          this.confirmed = true;
          this.$refs.modal.close();
          this.$store.commit("auth/SET_USER", res.data);
          this.eventBus.emit("toast", {
            title: this.$t("auth.messages.consentUpdated"),
            message: this.$t("auth.messages.consentUpdatedMessage"),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("errors.auth.consentUpdateError"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>

<style scoped>
.section-title {
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.preferences-language-switcher {
  margin-right: 0;
}

.consent-item {
  margin-bottom: 10px;
}

.consent-item:last-child {
  margin-bottom: 0;
}

.consent-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.consent-input {
  margin-right: 0.5rem;
}
</style>
