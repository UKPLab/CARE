<template>
  <AuthLayout :title="$t('auth.twoFactor.verifyTotp.title')">
    <form novalidate @submit.prevent="checkForm">
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

      <div class="row">
        <label
          class="col-md-4 col-form-label"
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

      <div class="my-4 text-center">
        <BasicButton
          class="btn btn-primary w-100"
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
    </form>
  </AuthLayout>
</template>

<script>
/**
 * TwoFactorVerifyTotp Component
 * 
 * @author: Linyin Huang
 */
import AuthLayout from "@/auth/AuthLayout.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "TwoFactorVerifyTotp",
  components: { AuthLayout, BasicButton },
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
          this.errorMessage = resolveApiMessage(
            response.data,
            "auth.twoFactor.verifyTotp.errors.invalidCode",
          );
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = resolveApiMessage(
          error.response?.data,
          "auth.twoFactor.verifyTotp.errors.verifyFailed",
        );
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
