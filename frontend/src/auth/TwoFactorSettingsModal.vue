<template>
  <BasicModal
    ref="modal"
    size="lg"
    name="TwoFactorSettingsModal"
    :remove-close="enforced && enabledMethods.length === 0"
    :disable-keyboard="enforced && enabledMethods.length === 0"
    @show="handleModalShow"
    @hide="handleModalHide"
  >
    <template #title>
      <span>{{ $t("auth.twoFactor.settings.title") }}</span>
    </template>
    <template #body>
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-4">
        <span class="text-primary" role="status"><BasicIcon icon-name="loading" /><span class="visually-hidden">{{ $t("common.loading") }}</span></span>
        <p class="text-muted mt-2">{{ $t("common.loading") }}</p>
      </div>
      <!-- Main Content -->
        <div v-else>
        <div v-if="enforced && enabledMethods.length === 0" class="alert alert-warning">
          <BasicIcon icon-name="shield-lock" />
          {{ $t("auth.twoFactor.settings.enforcedWarning") }}
        </div>
        <!-- Status Summary -->
        <div v-if="enabledMethods.length === 0" class="alert alert-info">
          <BasicIcon icon-name="info-circle" />
          {{ $t("auth.twoFactor.settings.status.none") }}
        </div>
        <div v-else class="alert alert-success">
          <BasicIcon icon-name="shield-check" />
          {{ $t("auth.twoFactor.settings.status.enabled", { count: enabledMethods.length }) }}
        </div>
        <EmailTwoFactorSettings
          :key="'email-' + formRevision" :enabled="emailEnabled"
          :has-email="hasEmail" :user-email="userEmail" :disabled="isSubmitting"
          :is-two-factor-required="isTwoFactorRequired" :enabled-methods="enabledMethods"
          :refresh-status="refreshStatus" @busy="isSubmitting = $event" />
        <TotpTwoFactorSettings
          :key="'totp-' + formRevision" :enabled="totpEnabled"
          :disabled="isSubmitting" :is-two-factor-required="isTwoFactorRequired"
          :enabled-methods="enabledMethods" :refresh-status="refreshStatus" @busy="isSubmitting = $event" />

        <!-- Info Section -->
        <div class="alert alert-light mt-3">
          <h6 class="alert-heading">
            <BasicIcon icon-name="info-circle" />
            {{ $t("auth.twoFactor.settings.info.title") }}
          </h6>
          <p class="small mb-0">
            {{ $t("auth.twoFactor.settings.info.description") }}
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <span v-if="!(enforced && enabledMethods.length === 0)" class="btn-group">
        <BasicButton
          :title="$t('common.close')"
          class="btn btn-secondary"
          @click="$refs.modal.close()"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import EmailTwoFactorSettings from './EmailTwoFactorSettings.vue';
import TotpTwoFactorSettings from './TotpTwoFactorSettings.vue';
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";

import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Modal for managing two-factor authentication settings
 * Supports email and TOTP (authenticator app) methods independently.
 *
 * @author: Linyin Huang
 */
import BasicIcon from "@/basic/Icon.vue";

export default {
  name: "TwoFactorSettingsModal",
  components: { EmailTwoFactorSettings, TotpTwoFactorSettings, BasicIcon, BasicModal, BasicButton },
  props: {
    enforced: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      // Loading states
      isLoading: false,
      isSubmitting: false,

      // 2FA state (from backend)
      twoFactorMethods: [],
      hasEmail: false,
      userEmail: null,

      // UI state
      emailEnabled: false,
      totpEnabled: false,

      // TOTP setup state
      modalVisible: false,
      formRevision: 0,
      isOpening: false,
    };
  },
  computed: {
    enabledMethods() {
      return this.twoFactorMethods || [];
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
  },
  methods: {
    refreshStatus() {return this.load2FAStatus(false);},
    async open() {
      if (this.modalVisible || this.isOpening) {
        return;
      }
      this.isOpening = true;

      try {
        await this.load2FAStatus();
        if (!this.$refs.modal || this.modalVisible) {
          return;
        }
        this.$refs.modal.open();
      } finally {
        this.isOpening = false;
      }
    },
    close() {
      if (!this.$refs.modal) return;

      if (this.modalVisible) {
        this.$refs.modal.close();
      }
    },
    // Public method
    isVisible() {
      return this.modalVisible;
    },
    async load2FAStatus(showLoading = true) {
      if (showLoading) this.isLoading = true;

      try {
        const response = await axios.get(getServerURL() + "/auth/2fa/status", {
          withCredentials: true,
        });

        if (response.status === 200) {
          this.twoFactorMethods = response.data.twoFactorMethods || [];
          this.hasEmail = response.data.email || false;
          this.userEmail = response.data.email || null;

          // Update UI toggles
          this.emailEnabled = this.twoFactorMethods.includes("email");
          this.totpEnabled = this.twoFactorMethods.includes("totp");

          // Keep auth store in sync with backend 2FA methods.
          if (this.$store.getters["auth/getUser"]) {
            this.$store.commit("auth/SET_USER", {
              twoFactorMethods: [...this.twoFactorMethods],
            });
          }
        }
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t("auth.twoFactor.settings.toasts.loadFailed"),
          message: resolveApiMessage(error.response?.data || error),
          variant: "danger",
        });
      } finally {
        this.isLoading = false;
      }
    },

    resetForm() {
      this.isSubmitting = false;
      this.formRevision++;
      this.emailEnabled = false;
      this.totpEnabled = false;
    },
    handleModalShow() {
      this.modalVisible = true;
    },
    handleModalHide() {
      this.modalVisible = false;
      this.resetForm();
    },
  },
};
</script>
