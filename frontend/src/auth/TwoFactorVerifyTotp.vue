<template>
  <form class="row g-3" novalidate @submit.prevent="checkForm">
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div class="text-center" style="margin-bottom: 20px">
          <IconAsset :height="200" name="logo" />
        </div>

        <div class="card">
          <div class="card-header">{{ $t("auth.twoFactor.verifyTotp.title") }}</div>

          <div class="card-body mx-4 my-4">
            <p v-if="showError" class="text-danger text-center">
              {{ errorMessage }}
            </p>

            <p v-if="showSuccess" class="text-success text-center">
              {{ successMessage }}
            </p>

            <div class="text-center mb-4">
              <p class="text-muted mb-1">
                {{ $t("auth.twoFactor.verifyTotp.descriptionLine1") }}
              </p>
              <p class="text-muted small mb-0">
                {{ $t("auth.twoFactor.verifyTotp.descriptionLine2") }}
              </p>
            </div>

            <div class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                for="totpCode"
                >{{ $t("auth.twoFactor.verifyTotp.authenticatorCode") }}</label
              >
              <div class="col-md-6">
                <input
                  id="totpCode"
                  v-model="formData.token"
                  autocomplete="one-time-code"
                  autofocus
                  class="form-control text-center otp-input"
                  :placeholder="$t('auth.twoFactor.verifyTotp.codePlaceholder')"
                  required
                  type="text"
                  maxlength="6"
                  pattern="[0-9]{6}"
                  @blur="checkVal('token')"
                  @input="formatCode"
                />
                <div
                  class="feedback-invalid"
                  :class="{ invalid: validity['token'] && !validToken }"
                >
                  {{ $t("auth.twoFactor.verifyTotp.invalidCode") }}
                </div>
              </div>
            </div>

            <div class="col-md-6 offset-md-4 my-4">
              <BasicButton
                class="btn btn-primary btn-block"
                type="submit"
                :loading="isSubmitting"
                :text="isSubmitting ? $t('auth.twoFactor.verifyTotp.verifying') : $t('auth.twoFactor.verifyTotp.verify')"
              />
              <BasicButton
                class="btn btn-link"
                :title="$t('common.cancel')"
                @click="cancelVerification"
              />
            </div>

            <div class="text-center text-muted small">
              <p class="mb-0">{{ $t("auth.twoFactor.verifyTotp.refreshHint") }}</p>
              <p class="mb-0">
                {{ $t("auth.twoFactor.verifyTotp.timeHint") }}
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
 * TwoFactorVerifyTotp Component
 * 
 * @author: Linyin Huang
 */
import IconAsset from "@/basic/icon/IconAsset.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "TwoFactorVerifyTotp",
  components: { IconAsset, BasicButton },
  data() {
    return {
      showError: false,
      errorMessage: "",
      showSuccess: false,
      successMessage: "",
      formData: {
        token: "",
      },
      validity: null,
      isSubmitting: false,
    };
  },
  computed: {
    validToken() {
      return /^[0-9]{6}$/.test(this.formData.token);
    },
    validForm() {
      return this.validToken;
    },
  },
  beforeMount() {
    this.validity = Object.fromEntries(
      Object.keys(this.formData).map((key) => [key, false]),
    );
  },
  methods: {
    checkVal(key) {
      this.validity[key] = true;
    },
    formatCode() {
      this.formData.token = this.formData.token.replace(/[^0-9]/g, "");
    },
    async checkForm() {
      Object.keys(this.validity).forEach((key) => {
        this.validity[key] = true;
      });
      if (this.validForm) {
        await this.verifyTotp();
      }
    },
    async verifyTotp() {
      this.isSubmitting = true;
      this.showError = false;
      this.showSuccess = false;

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/totp/verify",
          { token: this.formData.token },
          {
            validateStatus(status) {
              return [200, 400, 401, 403, 429].includes(status);
            },
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.showSuccess = true;
          this.successMessage = this.$t("auth.twoFactor.verifyTotp.success.verificationSuccessful");

          setTimeout(() => {
            this.$router.push(this.$route.query.redirectedFrom || "/dashboard");
          }, 1000);
        } else {
          this.showError = true;
          this.errorMessage =
            response.data.message ||
            this.$t("auth.twoFactor.verifyTotp.errors.invalidCode");
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage =
          error.response?.data?.message ||
          this.$t("auth.twoFactor.verifyTotp.errors.verifyFailed");
      } finally {
        this.isSubmitting = false;
      }
    },
    cancelVerification() {
      this.$router.push({ name: "login" });
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
