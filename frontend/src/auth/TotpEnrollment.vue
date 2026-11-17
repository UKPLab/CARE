<template>
          <!-- TOTP Setup Flow -->
          <div class="totp-setup-section mt-3">
            <div v-if="totpSetupStep === 'initiate'" class="setup-content">
              <div class="alert alert-info">
                <BasicIcon icon-name="info-circle" />
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
                <span v-else class="text-primary" role="status"><BasicIcon icon-name="loading" /><span class="visually-hidden">{{ $t("auth.twoFactor.settings.totp.generatingQrCode") }}</span></span>
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
                <BasicButton
                  class="btn btn-primary"
                  :disabled="!canVerifyTotpSetup"
                  :loading="isSubmitting"
                  :text="isSubmitting ? $t('auth.twoFactor.settings.totp.verifying') : $t('auth.twoFactor.settings.totp.verifyAndEnable')"
                  @click="verifyTotpSetup"
                />
                <BasicButton
                  class="btn btn-secondary"
                  :disabled="isSubmitting"
                  :title="$t('common.cancel')"
                  @click="cancelTotpSetup"
                />
              </div>
            </div>
          </div>

</template>
<script>
import BasicButton from '@/basic/Button.vue';
import BasicIcon from '@/basic/Icon.vue';
import axios from 'axios';
import getServerURL from '@/assets/serverUrl';
import { resolveApiMessage } from '@/assets/utils';
import QRCode from 'qrcode';
export default {
  name: 'TotpEnrollment', components: {BasicButton, BasicIcon},
  props: {refreshStatus: {type: Function, required: true}}, emits: ['busy','cancel','complete'],
  data() {return {isSubmitting: false, totpSetupStep: null, totpQrCode: null, totpQrCodeError: false, totpSecret: null, totpVerificationCode: ''};},
  computed: {canVerifyTotpSetup() {return /^[0-9]{6}$/.test(this.totpVerificationCode);}},
  watch: {isSubmitting: {handler(value) {this.$emit('busy',value);}, flush: 'sync'}},
  mounted() {this.initiateTotpSetup();},
  methods: {
    async initiateTotpSetup() {

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
          this.$emit("cancel");

          this.eventBus.emit("toast", {
            title: this.$t("auth.twoFactor.settings.toasts.totpSetupStartFailed"),
            message: resolveApiMessage(response.data),
            variant: "danger",
          });
        }
      } catch (error) {
        this.$emit("cancel");

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

          this.totpSetupStep = null;
          await this.refreshStatus();
          this.$emit("complete");
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
      this.$emit("cancel");
      this.totpSetupStep = null;
      this.totpQrCode = null;
      this.totpQrCodeError = false;
      this.totpSecret = null;
      this.totpVerificationCode = "";

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
    formatTotpCode() {
      this.totpVerificationCode = this.totpVerificationCode.replace(
        /[^0-9]/g,
        "",
      );
    }
 },
};
</script>
<style scoped>
.totp-setup-section {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--bs-border-color, #dee2e6);
  margin-top: 12px;
}

.qr-code-container {
  display: inline-block;
  padding: 12px;
  background-color: white;
  border-radius: 8px;
  border: 1px solid var(--bs-border-color, #dee2e6);
}

.qr-code-image {
  display: block;
  max-width: 200px;
  height: auto;
}

</style>
