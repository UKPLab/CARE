<template>
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
                :disabled="busy || isSettingUpTotp"
                @change="toggleTotp2FA"
              />
              <label class="form-check-label" for="toggle-totp">
                {{ totpEnabled ? $t("common.enabled") : $t("common.disabled") }}
              </label>
            </div>
          </div>
          <TotpEnrollment
v-if="isSettingUpTotp" :refresh-status="refreshStatus"
            @busy="setEnrollmentBusy" @cancel="cancelTotpSetup" @complete="completeTotpSetup" />
          <div
            v-if="totpEnabled && !isSettingUpTotp"
            class="alert alert-light small mb-0 mt-2"
          >
            <BasicIcon icon-name="check-circle" class="text-success" />
            {{ $t("auth.twoFactor.settings.totp.active") }}
          </div>
        </div>

</template>
<script>
import BasicIcon from '@/basic/Icon.vue';
import axios from 'axios';
import getServerURL from '@/assets/serverUrl';
import { resolveApiMessage } from '@/assets/utils';
import TotpEnrollment from './TotpEnrollment.vue';
export default {
  name: 'TotpTwoFactorSettings', components: {BasicIcon, TotpEnrollment}, props: {enabled: {type: Boolean, default: false}, disabled: {type: Boolean, default: false},
    isTwoFactorRequired: {type: Boolean, default: false}, enabledMethods: {type: Array, required: true},
    refreshStatus: {type: Function, required: true}}, emits: ['busy'],
  data() {return {totpEnabled: this.enabled, isSubmitting: false, isSettingUpTotp: false};},
  computed: { busy() { return this.disabled || this.isSubmitting; } },
  watch: { enabled(value) { this.totpEnabled = value; },
    isSubmitting: {handler(value) { this.$emit('busy', value); }, flush: 'sync'} },
  methods: {
  setEnrollmentBusy(value) {this.isSubmitting = value;},
  cancelTotpSetup() {this.isSettingUpTotp=false; this.totpEnabled=false; this.isSubmitting=false;},
  completeTotpSetup() {this.isSettingUpTotp=false; this.isSubmitting=false;},
    async toggleTotp2FA() {
      if (this.totpEnabled) {
        this.isSettingUpTotp = true;
      } else {
        await this.disableTotp2FA();
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
          await this.refreshStatus();
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
    }
 },
};
</script>
<style scoped>
.method-section {
  border-bottom: 1px solid var(--bs-border-color, #dee2e6);
  padding-bottom: 1rem;
}

.method-section:last-child {
  border-bottom: none;
}
.form-check-input {
  cursor: pointer;
}

.form-check-label {
  cursor: pointer;
}
</style>
