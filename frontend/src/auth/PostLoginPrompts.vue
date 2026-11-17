<template>
  <ConsentModal ref="consentModal" />
  <TwoFactorSettingsModal ref="twoFactorSettingsModal" :enforced="true" />
</template>
<script>
import ConsentModal from './ConsentModal.vue';
import TwoFactorSettingsModal from './TwoFactorSettingsModal.vue';
export default {
  name: 'PostLoginPrompts',
  components: { ConsentModal, TwoFactorSettingsModal },
  computed: {
    hasTwoFactorConfigured() {
      const user = this.$store.getters["auth/getUser"];
      const methods = Array.isArray(user?.twoFactorMethods) ? user.twoFactorMethods : [];
      return methods.length > 0;
    },
    loginMethod() {
      const user = this.$store.getters["auth/getUser"];
      if (!user) return null;
      if (user.loginMethod) return user.loginMethod;
      if (user.orcidId) return "orcid";
      if (user.ldapUsername) return "ldap";
      if (user.samlNameId) return "saml";
      return "local";
    },
    isTwoFactorRequired() {
      if (!this.loginMethod) return false;
      return this.$store.getters["settings/getValue"](`system.auth.${this.loginMethod}.2fa.required`) === "true";
    },
    isTermsConsented() {
      return !!this.$store.getters["auth/getUser"]?.acceptTerms;
    },
    shouldShowConsentModal() {
      return !this.isTermsConsented;
    },
    shouldForceTwoFactorSetup() {
      return this.isTermsConsented &&
          this.isTwoFactorRequired &&
          !this.hasTwoFactorConfigured;
    }
  },
  watch: {
    shouldShowConsentModal: 'syncPostLoginModalFlow',
    shouldForceTwoFactorSetup: 'syncPostLoginModalFlow',
    isTermsConsented: 'syncPostLoginModalFlow',
  },
  mounted() { this.syncPostLoginModalFlow(); },
  methods: {
    syncPostLoginModalFlow() {
      this.$nextTick(() => {
        if (this.shouldShowConsentModal) {
          if (this.$refs.twoFactorSettingsModal?.isVisible()) {
            this.$refs.twoFactorSettingsModal.close();
          }
          if (this.$refs.consentModal) {
            this.$refs.consentModal.open();
          }
          return;
        }

        if (this.shouldForceTwoFactorSetup) {
          if (this.$refs.consentModal?.isVisible()) {
            this.$refs.consentModal.close();
          }
          if (this.$refs.twoFactorSettingsModal) {
            this.$refs.twoFactorSettingsModal.open();
          }
          return;
        }

        if (this.$refs.consentModal?.isVisible()) {
          this.$refs.consentModal.close();
        }
        if (this.$refs.twoFactorSettingsModal?.isVisible()) {
          this.$refs.twoFactorSettingsModal.close();
        }
      });
    }
  },
};
</script>
