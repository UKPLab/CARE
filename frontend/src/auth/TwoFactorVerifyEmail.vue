<template>
  <form class="row g-3" novalidate @submit.prevent="checkForm">
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div class="text-center" style="margin-bottom: 20px">
          <IconAsset :height="200" name="logo" />
        </div>

        <div class="card">
          <div class="card-header">{{ $t("auth.twoFactor.verifyEmail.title") }}</div>

          <div class="card-body mx-4 my-4">
            <p v-if="showError" class="text-danger text-center">
              {{ errorMessage }}
            </p>

            <p v-if="showSuccess" class="text-success text-center">
              {{ successMessage }}
            </p>
            <div class="text-center mb-4">
              <p class="text-muted">
                {{ $t("auth.twoFactor.verifyEmail.descriptionLine1") }}
                <br />
                {{ $t("auth.twoFactor.verifyEmail.descriptionLine2") }}
              </p>
            </div>

            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="otp"
                >{{ $t("auth.twoFactor.verifyEmail.verificationCode") }}</label
              >
              <div class="col-md-6">
                <input
                  id="otp"
                  v-model="formData.otp"
                  autocomplete="one-time-code"
                  autofocus
                  class="form-control text-center otp-input"
                  :placeholder="$t('auth.twoFactor.verifyEmail.codePlaceholder')"
                  required
                  type="text"
                  maxlength="6"
                  pattern="[0-9]{6}"
                  @blur="checkVal('otp')"
                  @input="formatOTP"
                />
                <div
                  class="feedback-invalid"
                  :class="{ invalid: validity['otp'] && !validOTP }"
                >
                  {{ $t("auth.twoFactor.verifyEmail.invalidCode") }}
                </div>
              </div>
            </div>

            <div class="col-md-6 offset-md-4 my-4">
              <button
                class="btn btn-primary btn-block"
                type="submit"
                :disabled="isSubmitting"
              >
                <span
                  v-if="isSubmitting"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                {{ isSubmitting ? $t("auth.twoFactor.verifyEmail.verifying") : $t("auth.twoFactor.verifyEmail.verify") }}
              </button>
              <button
                class="btn btn-link"
                type="button"
                :disabled="isResending || resendCooldown > 0"
                @click="resendCode"
              >
                {{ resendButtonText }}
              </button>
              <button
                class="btn btn-link"
                type="button"
                @click="cancelVerification"
              >
                {{ $t("common.cancel") }}
              </button>
            </div>

            <div class="text-center text-muted small">
              <p>{{ $t("auth.twoFactor.verifyEmail.expirationHint") }}</p>
              <p>
                {{ $t("auth.twoFactor.verifyEmail.resendHint") }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
</template>

<script>
/**
 * TwoFactorVerifyEmail Component
 *
 * Email OTP verification page during the login flow.
 *
 * @author: Linyin Huang
 */
import IconAsset from "@/basic/icon/IconAsset.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "TwoFactorVerifyEmail",
  components: { IconAsset },
  data() {
    return {
      showError: false,
      errorMessage: "",
      showSuccess: false,
      successMessage: "",
      formData: {
        otp: "",
      },
      validity: null,
      isSubmitting: false,
      isResending: false,
      resendCooldown: 0,
      resendInterval: null,
    };
  },
  computed: {
    validOTP() {
      return /^[0-9]{6}$/.test(this.formData.otp);
    },
    validForm() {
      return this.validOTP;
    },
    resendButtonText() {
      if (this.isResending) {
        return this.$t("auth.twoFactor.verifyEmail.sending");
      }
      if (this.resendCooldown > 0) {
        return this.$t("auth.twoFactor.verifyEmail.resendCodeIn", { seconds: this.resendCooldown });
      }
      return this.$t("auth.twoFactor.verifyEmail.resendCode");
    },
  },
  beforeMount() {
    this.validity = Object.fromEntries(
      Object.keys(this.formData).map((key) => [key, false]),
    );
  },
  mounted() {
    this.fetchResendStatus();
  },
  beforeUnmount() {
    this.clearResendInterval();
  },
  methods: {
    checkVal(key) {
      this.validity[key] = true;
    },
    formatOTP() {
      // Only allow numbers
      this.formData.otp = this.formData.otp.replace(/[^0-9]/g, "");
    },
    clearResendInterval() {
      if (this.resendInterval) {
        clearInterval(this.resendInterval);
        this.resendInterval = null;
      }
    },
    updateResendCooldown(cooldownUntil) {
      const remainingSeconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

      this.resendCooldown = remainingSeconds;

      if (remainingSeconds === 0) {
        this.clearResendInterval();
      }
    },
    startResendCooldown(cooldownUntil) {
      this.updateResendCooldown(cooldownUntil);
      this.clearResendInterval();

      this.resendInterval = setInterval(() => {
        this.updateResendCooldown(cooldownUntil);
      }, 1000);
    },
    applyCooldownFromResponse(payload) {
      if (!payload?.cooldownUntil) {
        this.resendCooldown = 0;
        this.clearResendInterval();
        return;
      }

      this.startResendCooldown(payload.cooldownUntil);
    },
    async fetchResendStatus() {
      try {
        const response = await axios.get(getServerURL() + "/auth/2fa/email/status", {
          withCredentials: true,
        });

        this.applyCooldownFromResponse(response.data);
      } catch (error) {
        this.showError = true;
        this.errorMessage =
          error.response?.data?.message ||
          this.$t("auth.twoFactor.verifyEmail.errors.loadStatusFailed");
      }
    },
    async checkForm() {
      Object.keys(this.validity).map((key) => {
        this.validity[key] = true;
      });
      if (this.validForm) {
        await this.verifyOTP();
      }
    },
    async verifyOTP() {
      this.isSubmitting = true;
      this.showError = false;
      this.showSuccess = false;

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/email/verify",
          { otp: this.formData.otp },
          {
            validateStatus: function (status) {
              return [200, 400, 401, 403, 429].includes(status);
            },
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.showSuccess = true;
          this.successMessage = this.$t("auth.twoFactor.verifyEmail.success.verificationSuccessful");

          // Redirect to dashboard
          setTimeout(() => {
            this.$router.push(this.$route.query.redirectedFrom || "/dashboard");
          }, 1000);
        } else {
          this.showError = true;
          this.errorMessage =
            response.data.message ||
            this.$t("auth.twoFactor.verifyEmail.errors.invalidCode");
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage =
          error.response?.data?.message ||
          this.$t("auth.twoFactor.verifyEmail.errors.verifyFailed");
      } finally {
        this.isSubmitting = false;
      }
    },
    async resendCode() {
      if (this.isResending || this.resendCooldown > 0) {
        return;
      }

      this.isResending = true;
      this.showError = false;
      this.showSuccess = false;

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/otp/resend",
          {},
          {
            validateStatus: function (status) {
              return status === 200 || status === 400 || status === 429;
            },
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.showSuccess = true;
          this.successMessage =
            this.$t("auth.twoFactor.verifyEmail.success.codeSent");

          this.applyCooldownFromResponse(response.data);
        } else if (response.status === 429) {
          this.showError = true;
          this.errorMessage =
            response.data.message || this.$t("auth.twoFactor.verifyEmail.errors.waitBeforeResend");
          this.applyCooldownFromResponse(response.data);
        } else {
          this.showError = true;
          this.errorMessage =
            response.data.message || this.$t("auth.twoFactor.verifyEmail.errors.resendFailed");
        }
      } catch (_error) {
        this.showError = true;
        this.errorMessage = this.$t("auth.twoFactor.verifyEmail.errors.resendFailed");
      } finally {
        this.isResending = false;
      }
    },
    cancelVerification() {
      this.$router.push("/login");
    },
  },
};
</script>

<style scoped>
form {
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.feedback-invalid {
  font-size: 0.75em;
  color: firebrick;
  visibility: hidden;
  padding-top: 4px;
}

.feedback-invalid.invalid {
  visibility: visible;
}

input.custom-invalid {
  border: transparent;
  outline: 1px solid firebrick;
  border-radius: 1px;
}

input:focus.custom-invalid {
  outline: none;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
}
</style>
