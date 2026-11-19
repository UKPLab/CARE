<template>
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
                :disabled="busy || !hasEmail"
                @change="toggleEmail2FA"
              />
              <label class="form-check-label" for="toggle-email">
                {{ emailEnabled ? $t("common.enabled") : $t("common.disabled") }}
              </label>
            </div>
          </div>
          <div v-if="emailEnabled" class="alert alert-light small mb-0">
            <BasicIcon icon-name="check-circle" class="text-success" />
            {{ $t("auth.twoFactor.settings.email.codesSentTo") }} <strong>{{ userEmail }}</strong>
          </div>
          <div v-if="!hasEmail" class="alert alert-warning small mb-0 mt-2">
            <BasicIcon icon-name="exclamation-triangle" />
            {{ $t("auth.twoFactor.settings.email.emailRequiredHint") }}
          </div>
        </div>
</template>
<script>
import BasicIcon from '@/basic/Icon.vue';
import axios from 'axios';
import getServerURL from '@/assets/serverUrl';
import { resolveApiMessage } from '@/assets/utils';
export default {
  name: 'EmailTwoFactorSettings', components: {BasicIcon},
  props: {enabled: {type: Boolean, default: false}, disabled: {type: Boolean, default: false},
    isTwoFactorRequired: {type: Boolean, default: false}, enabledMethods: {type: Array, required: true},
    refreshStatus: {type: Function, required: true}, hasEmail: {type: Boolean, default: false}, userEmail: {type: String, default: null}},
  emits: ['busy'],
  data() {return {emailEnabled: this.enabled, isSubmitting: false};},
  computed: { busy() { return this.disabled || this.isSubmitting; } },
  watch: { enabled(value) { this.emailEnabled = value; },
    isSubmitting: {handler(value) { this.$emit('busy', value); }, flush: 'sync'} },
  methods: {
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
          await this.refreshStatus();
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
          await this.refreshStatus();
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
