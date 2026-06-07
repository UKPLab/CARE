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
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">{{ $t("common.loading") }}</span>
        </div>
        <p class="text-muted mt-2">{{ $t("common.loading") }}</p>
      </div>
      <!-- Main Content -->
        <div v-else>
        <div v-if="enforced && enabledMethods.length === 0" class="alert alert-warning">
          <i class="bi bi-shield-lock"></i>
          {{ $t("auth.twoFactor.settings.enforcedWarning") }}
        </div>
        <!-- Status Summary -->
        <div v-if="enabledMethods.length === 0" class="alert alert-info">
          <i class="bi bi-info-circle"></i>
          {{ $t("auth.twoFactor.settings.status.none") }}
        </div>
        <div v-else class="alert alert-success">
          <i class="bi bi-shield-check"></i>
          {{ $t("auth.twoFactor.settings.status.enabled", { count: enabledMethods.length }) }}
        </div>
        <!-- Email 2FA Section -->
        <div class="method-section mb-4">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <h6 class="mb-1">{{ $t("auth.twoFactor.settings.email.title") }}</h6>
              <p class="text-muted small mb-0">
                {{ $t("auth.twoFactor.settings.email.description") }}
              </p>
            </div>
            <div class="form-check form-switch">
              <input
                id="toggle-email"
                v-model="emailEnabled"
                class="form-check-input"
                type="checkbox"
                :disabled="isSubmitting || !hasEmail"
                @change="toggleEmail2FA"
              />
              <label class="form-check-label" for="toggle-email">
                {{ emailEnabled ? $t("common.enabled") : $t("common.disabled") }}
              </label>
            </div>
          </div>
          <div v-if="emailEnabled" class="alert alert-light small mb-0">
            <i class="bi bi-check-circle text-success"></i>
            {{ $t("auth.twoFactor.settings.email.codesSentTo") }} <strong>{{ userEmail }}</strong>
          </div>
          <div v-if="!hasEmail" class="alert alert-warning small mb-0 mt-2">
            <i class="bi bi-exclamation-triangle"></i>
            {{ $t("auth.twoFactor.settings.email.emailRequiredHint") }}
          </div>
        </div>
        <!-- TOTP 2FA Section -->
        <div class="method-section mb-4">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <h6 class="mb-1">{{ $t("auth.twoFactor.settings.totp.title") }}</h6>
              <p class="text-muted small mb-0">
                {{ $t("auth.twoFactor.settings.totp.description") }}
              </p>
            </div>
            <div class="form-check form-switch">
              <input
                id="toggle-totp"
                v-model="totpEnabled"
                class="form-check-input"
                type="checkbox"
                :disabled="isSubmitting || isSettingUpTotp"
                @change="toggleTotp2FA"
              />
              <label class="form-check-label" for="toggle-totp">
                {{ totpEnabled ? $t("common.enabled") : $t("common.disabled") }}
              </label>
            </div>
          </div>
          <!-- TOTP Setup Flow -->
          <div v-if="isSettingUpTotp" class="totp-setup-section mt-3">
            <div v-if="totpSetupStep === 'initiate'" class="setup-content">
              <div class="alert alert-info">
                <i class="bi bi-info-circle"></i>
                {{ $t("auth.twoFactor.settings.totp.scanQrInstruction") }}
              </div>
              <div class="text-center my-3">
                <div v-if="totpQrCode" class="qr-code-container">
                  <img
                    :src="totpQrCode"
                    :alt="$t('auth.twoFactor.settings.totp.qrCodeAlt')"
                    class="qr-code-image"
                  />
                </div>
                <div v-else-if="totpQrCodeError" class="alert alert-warning small mb-0">
                  {{ $t("auth.twoFactor.settings.totp.qrCodeError") }}
                </div>
                <div v-else class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">{{ $t("auth.twoFactor.settings.totp.generatingQrCode") }}</span>
                </div>
              </div>
              <div v-if="totpSecret" class="alert alert-light small">
                <strong>{{ $t("auth.twoFactor.settings.totp.manualEntry") }}</strong> {{ totpSecret }}
              </div>
              <div class="form-group mt-3">
                <label class="form-label">{{ $t("auth.twoFactor.settings.totp.enterVerificationCode") }}</label>
                <input
                  v-model="totpVerificationCode"
                  type="text"
                  class="form-control text-center"
                  placeholder="000000"
                  maxlength="6"
                  pattern="[0-9]{6}"
                  @input="formatTotpCode"
                />
                <div class="form-text">
                  {{ $t("auth.twoFactor.settings.totp.enterCodeHint") }}
                </div>
              </div>
              <div class="d-flex gap-2 mt-3">
                <button
                  type="button"
                  class="btn btn-primary"
                  :disabled="!canVerifyTotpSetup || isSubmitting"
                  @click="verifyTotpSetup"
                >
                  {{ isSubmitting ? $t("auth.twoFactor.settings.totp.verifying") : $t("auth.twoFactor.settings.totp.verifyAndEnable") }}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="isSubmitting"
                  @click="cancelTotpSetup"
                >
                  {{ $t("common.cancel") }}
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="totpEnabled && !isSettingUpTotp"
            class="alert alert-light small mb-0 mt-2"
          >
            <i class="bi bi-check-circle text-success"></i>
            {{ $t("auth.twoFactor.settings.totp.active") }}
          </div>
        </div>

        <!-- Info Section -->
        <div class="alert alert-light mt-3">
          <h6 class="alert-heading">
            <i class="bi bi-info-circle"></i>
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
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import QRCode from "qrcode";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Modal for managing two-factor authentication settings
 * Supports email and TOTP (authenticator app) methods independently.
 *
 * @author: Linyin Huang
 */
export default {
  name: "TwoFactorSettingsModal",
  components: { BasicModal, BasicButton },
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
      isSettingUpTotp: false,
      totpSetupStep: null, // 'initiate' | null
      totpQrCode: null,
      totpQrCodeError: false,
      totpSecret: null,
      totpVerificationCode: "",
      modalVisible: false,
      isOpening: false,
    };
  },
  computed: {
    enabledMethods() {
      return this.twoFactorMethods || [];
    },
    canVerifyTotpSetup() {
      return /^[0-9]{6}$/.test(this.totpVerificationCode);
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
    async load2FAStatus() {
      this.isLoading = true;

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
    async toggleEmail2FA() {
      if (this.emailEnabled) {
        await this.enableEmail2FA();
      } else {
        await this.disableEmail2FA();
      }
    },
    async enableEmail2FA() {
      if (!this.hasEmail) {
        this.eventBus.emit("toast", {
          title: this.$t("auth.twoFactor.settings.toasts.emailRequired"),
          message: this.$t("auth.twoFactor.settings.email.emailRequiredHint"),
          variant: "warning",
        });
        this.emailEnabled = false;
        return;
      }

      this.isSubmitting = true;

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/enable",
          { method: "email" },
          {
            validateStatus: (status) => status === 200 || status === 400,
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.emailEnabled.title"),
            message: this.$t("auth.twoFactor.settings.toasts.emailEnabled.message"),
            variant: "success",
          });
          await this.load2FAStatus();
        } else {
          this.emailEnabled = false;
          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.emailEnableFailed"),
            message: resolveApiMessage(response.data),
            variant: "danger",
          });
        }
      } catch (error) {
        this.emailEnabled = false;
        this.eventBus.emit("toast", {
          title: this.$t("auth.twoFactor.settings.toasts.emailEnableFailed"),
          message: resolveApiMessage(error.response?.data || error),
          variant: "danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    async disableEmail2FA() {
      if (this.isTwoFactorRequired && this.enabledMethods.length <= 1) {
        this.eventBus.emit("toast", {
          title: this.$t("auth.twoFactor.settings.toasts.actionBlocked.title"),
          message: this.$t("auth.twoFactor.settings.toasts.actionBlocked.message"),
          variant: "warning",
        });
        this.emailEnabled = true;
        return;
      }

      if (
        !confirm(
          this.$t("auth.twoFactor.settings.confirm.disableEmail"),
        )
      ) {
        this.emailEnabled = true;
        return;
      }

      this.isSubmitting = true;

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/disable/email",
          {},
          {
            validateStatus: (status) => status === 200 || status === 400,
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.emailDisabled.title"),
            message: this.$t("auth.twoFactor.settings.toasts.emailDisabled.message"),
            variant: "success",
          });
          await this.load2FAStatus();
        } else {
          this.emailEnabled = true;
          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.emailDisableFailed"),
            message: resolveApiMessage(response.data),
            variant: "danger",
          });
        }
      } catch (error) {
        this.emailEnabled = true;
        this.eventBus.emit("toast", {
          title: this.$t("auth.twoFactor.settings.toasts.emailDisableFailed"),
          message: resolveApiMessage(error.response?.data || error),
          variant: "danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    async toggleTotp2FA() {
      if (this.totpEnabled) {
        await this.initiateTotpSetup();
      } else {
        await this.disableTotp2FA();
      }
    },
    async initiateTotpSetup() {
      this.isSettingUpTotp = true;
      this.totpSetupStep = "initiate";
      this.totpQrCode = null;
      this.totpQrCodeError = false;
      this.totpSecret = null;
      this.totpVerificationCode = "";

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/totp/setup/initiate",
          {},
          {
            validateStatus: (status) => status === 200 || status === 400,
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.totpSecret = response.data.secretBase32;
          const otpauthUrl = response.data.otpauthUrl;
          await this.generateTotpQrCode(otpauthUrl);
        } else {
          this.isSettingUpTotp = false;
          this.totpEnabled = false;
          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.totpSetupStartFailed"),
            message: resolveApiMessage(response.data),
            variant: "danger",
          });
        }
      } catch (error) {
        this.isSettingUpTotp = false;
        this.totpEnabled = false;
        this.eventBus.emit("toast", {
          title: this.$t("auth.twoFactor.settings.toasts.totpSetupStartFailed"),
          message: resolveApiMessage(error.response?.data || error),
          variant: "danger",
        });
      }
    },
    async verifyTotpSetup() {
      if (!this.canVerifyTotpSetup) {
        return;
      }

      this.isSubmitting = true;

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/totp/setup/verify",
          { token: this.totpVerificationCode },
          {
            validateStatus: (status) =>
              status === 200 || status === 400 || status === 401,
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.totpEnabled.title"),
            message: this.$t("auth.twoFactor.settings.toasts.totpEnabled.message"),
            variant: "success",
          });

          this.isSettingUpTotp = false;
          this.totpSetupStep = null;
          await this.load2FAStatus();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.verificationFailed"),
            message: resolveApiMessage(response.data),
            variant: "danger",
          });
        }
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t("auth.twoFactor.settings.toasts.verificationFailed"),
          message: resolveApiMessage(error.response?.data || error),
          variant: "danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    cancelTotpSetup() {
      this.isSettingUpTotp = false;
      this.totpSetupStep = null;
      this.totpQrCode = null;
      this.totpQrCodeError = false;
      this.totpSecret = null;
      this.totpVerificationCode = "";
      this.totpEnabled = false;
    },
    async generateTotpQrCode(otpauthUrl) {
      if (!otpauthUrl) {
        this.totpQrCodeError = true;
        return;
      }

      try {
        this.totpQrCode = await QRCode.toDataURL(otpauthUrl, {
          width: 200,
          margin: 1,
        });
        this.totpQrCodeError = false;
      } catch (_error) {
        this.totpQrCode = null;
        this.totpQrCodeError = true;
      }
    },
    async disableTotp2FA() {
      if (this.isTwoFactorRequired && this.enabledMethods.length <= 1) {
        this.eventBus.emit("toast", {
          title: this.$t("auth.twoFactor.settings.toasts.actionBlocked.title"),
          message: this.$t("auth.twoFactor.settings.toasts.actionBlocked.message"),
          variant: "warning",
        });
        this.totpEnabled = true;
        return;
      }

      if (
        !confirm(
          this.$t("auth.twoFactor.settings.confirm.disableTotp"),
        )
      ) {
        this.totpEnabled = true;
        return;
      }

      this.isSubmitting = true;

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/disable/totp",
          {},
          {
            validateStatus: (status) => status === 200 || status === 400,
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.totpDisabled.title"),
            message: this.$t("auth.twoFactor.settings.toasts.totpDisabled.message"),
            variant: "success",
          });
          await this.load2FAStatus();
        } else {
          this.totpEnabled = true;
          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.totpDisableFailed"),
            message: resolveApiMessage(response.data),
            variant: "danger",
          });
        }
      } catch (error) {
        this.totpEnabled = true;
        this.eventBus.emit("toast", {
          title: this.$t("auth.twoFactor.settings.toasts.totpDisableFailed"),
          message: resolveApiMessage(error.response?.data || error),
          variant: "danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    formatTotpCode() {
      this.totpVerificationCode = this.totpVerificationCode.replace(
        /[^0-9]/g,
        "",
      );
    },
    resetForm() {
      this.emailEnabled = false;
      this.totpEnabled = false;
      this.isSettingUpTotp = false;
      this.totpSetupStep = null;
      this.totpQrCode = null;
      this.totpQrCodeError = false;
      this.totpSecret = null;
      this.totpVerificationCode = "";
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

<style scoped>
.method-section {
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 1rem;
}

.method-section:last-child {
  border-bottom: none;
}

.totp-setup-section {
  background-color: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  margin-top: 12px;
}

.qr-code-container {
  display: inline-block;
  padding: 12px;
  background-color: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.qr-code-image {
  display: block;
  max-width: 200px;
  height: auto;
}

.form-check-input {
  cursor: pointer;
}

.form-check-label {
  cursor: pointer;
}
</style>
