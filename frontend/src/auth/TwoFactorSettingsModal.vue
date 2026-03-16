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
      <span>Two-Factor Authentication Settings</span>
    </template>
    <template #body>
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted mt-2">Loading...</p>
      </div>
      <!-- Main Content -->
        <div v-else>
        <div v-if="enforced && enabledMethods.length === 0" class="alert alert-warning">
          <i class="bi bi-shield-lock"></i>
          Two-factor authentication is required by your administrator. Configure at least one method to continue.
        </div>
        <!-- Status Summary -->
        <div v-if="enabledMethods.length === 0" class="alert alert-info">
          <i class="bi bi-info-circle"></i>
          <strong>Status:</strong> No 2FA methods enabled
        </div>
        <div v-else class="alert alert-success">
          <i class="bi bi-shield-check"></i>
          Status: {{ enabledMethods.length }} method(s) enabled
        </div>
        <!-- Email 2FA Section -->
        <div class="method-section mb-4">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <h6 class="mb-1">Email Verification</h6>
              <p class="text-muted small mb-0">
                Receive a 6-digit code via email when logging in
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
                {{ emailEnabled ? "Enabled" : "Disabled" }}
              </label>
            </div>
          </div>
          <div v-if="emailEnabled" class="alert alert-light small mb-0">
            <i class="bi bi-check-circle text-success"></i>
            Codes will be sent to: <strong>{{ userEmail }}</strong>
          </div>
          <div v-if="!hasEmail" class="alert alert-warning small mb-0 mt-2">
            <i class="bi bi-exclamation-triangle"></i>
            You need to add and verify an email address in your profile first
          </div>
        </div>
        <!-- TOTP 2FA Section -->
        <div class="method-section mb-4">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <h6 class="mb-1">Authenticator App (TOTP)</h6>
              <p class="text-muted small mb-0">
                Use an authenticator app like Google Authenticator
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
                {{ totpEnabled ? "Enabled" : "Disabled" }}
              </label>
            </div>
          </div>
          <!-- TOTP Setup Flow -->
          <div v-if="isSettingUpTotp" class="totp-setup-section mt-3">
            <div v-if="totpSetupStep === 'initiate'" class="setup-content">
              <div class="alert alert-info">
                <i class="bi bi-info-circle"></i>
                Scan the QR code with your authenticator app, then enter the
                code to verify setup.
              </div>
              <div class="text-center my-3">
                <div v-if="totpQrCode" class="qr-code-container">
                  <img
                    :src="totpQrCode"
                    alt="TOTP QR Code"
                    class="qr-code-image"
                  />
                </div>
                <div v-else-if="totpQrCodeError" class="alert alert-warning small mb-0">
                  Could not generate QR code. Use the manual entry key below.
                </div>
                <div v-else class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Generating QR code...</span>
                </div>
              </div>
              <div v-if="totpSecret" class="alert alert-light small">
                <strong>Manual entry:</strong> {{ totpSecret }}
              </div>
              <div class="form-group mt-3">
                <label class="form-label">Enter verification code</label>
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
                  Enter the 6-digit code from your authenticator app
                </div>
              </div>
              <div class="d-flex gap-2 mt-3">
                <button
                  type="button"
                  class="btn btn-primary"
                  :disabled="!canVerifyTotpSetup || isSubmitting"
                  @click="verifyTotpSetup"
                >
                  {{ isSubmitting ? "Verifying..." : "Verify & Enable" }}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="isSubmitting"
                  @click="cancelTotpSetup"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="totpEnabled && !isSettingUpTotp"
            class="alert alert-light small mb-0 mt-2"
          >
            <i class="bi bi-check-circle text-success"></i>
            TOTP is configured and active
          </div>
        </div>

        <!-- Info Section -->
        <div class="alert alert-light mt-3">
          <h6 class="alert-heading">
            <i class="bi bi-info-circle"></i>
            How it works
          </h6>
          <p class="small mb-0">
            When logging in, you'll be asked to verify using one of your enabled
            methods. If multiple methods are enabled, you can choose which one
            to use.
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <span v-if="!(enforced && enabledMethods.length === 0)" class="btn-group">
        <BasicButton
          title="Close"
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
    isTwoFactorRequired() {
      return this.$store.getters["settings/getValue"]("system.auth.2fa.required") === "true";
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
          title: "Failed to load 2FA settings",
          message:
            error.response?.data?.message ||
            "An error occurred while loading 2FA settings",
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
          title: "Email required",
          message:
            "Please add and verify an email address in your profile first",
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
            title: "Email 2FA enabled",
            message: "Email verification has been enabled",
            variant: "success",
          });
          await this.load2FAStatus();
        } else {
          this.emailEnabled = false;
          this.eventBus.emit("toast", {
            title: "Failed to enable email 2FA",
            message: response.data.message || "Failed to enable email 2FA",
            variant: "danger",
          });
        }
      } catch (error) {
        this.emailEnabled = false;
        this.eventBus.emit("toast", {
          title: "Failed to enable email 2FA",
          message:
            error.response?.data?.message ||
            "An error occurred while enabling email 2FA",
          variant: "danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    async disableEmail2FA() {
      if (this.isTwoFactorRequired && this.enabledMethods.length <= 1) {
        this.eventBus.emit("toast", {
          title: "Action blocked",
          message:
            "2FA is required. Configure another method before disabling this one.",
          variant: "warning",
        });
        this.emailEnabled = true;
        return;
      }

      if (
        !confirm(
          "Are you sure you want to disable email 2FA? This will reduce your account security.",
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
            title: "Email 2FA disabled",
            message: "Email verification has been disabled",
            variant: "success",
          });
          await this.load2FAStatus();
        } else {
          this.emailEnabled = true;
          this.eventBus.emit("toast", {
            title: "Failed to disable email 2FA",
            message: response.data.message || "Failed to disable email 2FA",
            variant: "danger",
          });
        }
      } catch (error) {
        this.emailEnabled = true;
        this.eventBus.emit("toast", {
          title: "Failed to disable email 2FA",
          message:
            error.response?.data?.message ||
            "An error occurred while disabling email 2FA",
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
            title: "Failed to start TOTP setup",
            message: response.data.message || "Failed to initiate TOTP setup",
            variant: "danger",
          });
        }
      } catch (error) {
        this.isSettingUpTotp = false;
        this.totpEnabled = false;
        this.eventBus.emit("toast", {
          title: "Failed to start TOTP setup",
          message:
            error.response?.data?.message ||
            "An error occurred while starting TOTP setup",
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
            title: "TOTP enabled",
            message: "Authenticator app has been successfully configured",
            variant: "success",
          });

          this.isSettingUpTotp = false;
          this.totpSetupStep = null;
          await this.load2FAStatus();
        } else {
          this.eventBus.emit("toast", {
            title: "Verification failed",
            message: response.data.message || "Invalid code. Please try again.",
            variant: "danger",
          });
        }
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Verification failed",
          message:
            error.response?.data?.message ||
            "Failed to verify TOTP code. Please try again.",
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
      } catch (error) {
        this.totpQrCode = null;
        this.totpQrCodeError = true;
      }
    },
    async disableTotp2FA() {
      if (this.isTwoFactorRequired && this.enabledMethods.length <= 1) {
        this.eventBus.emit("toast", {
          title: "Action blocked",
          message:
            "2FA is required. Configure another method before disabling this one.",
          variant: "warning",
        });
        this.totpEnabled = true;
        return;
      }

      if (
        !confirm(
          "Are you sure you want to disable TOTP 2FA? This will reduce your account security.",
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
            title: "TOTP disabled",
            message: "TOTP has been disabled",
            variant: "success",
          });
          await this.load2FAStatus();
        } else {
          this.totpEnabled = true;
          this.eventBus.emit("toast", {
            title: "Failed to disable TOTP",
            message: response.data.message || "Failed to disable TOTP",
            variant: "danger",
          });
        }
      } catch (error) {
        this.totpEnabled = true;
        this.eventBus.emit("toast", {
          title: "Failed to disable TOTP",
          message:
            error.response?.data?.message ||
            "An error occurred while disabling TOTP",
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
