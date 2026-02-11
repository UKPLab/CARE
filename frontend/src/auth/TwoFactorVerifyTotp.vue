<template>
  <form class="row g-3" novalidate @submit.prevent="checkForm">
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div class="text-center" style="margin-bottom: 20px">
          <IconAsset :height="200" name="logo" />
        </div>

        <div class="card">
          <div class="card-header">Two-Factor Authentication</div>

          <div class="card-body mx-4 my-4">
            <p v-if="showError" class="text-danger text-center">
              {{ errorMessage }}
            </p>

            <p v-if="showSuccess" class="text-success text-center">
              {{ successMessage }}
            </p>

            <div class="text-center mb-4">
              <p class="text-muted mb-1">
                Open your authenticator app and enter the 6-digit code
              </p>
              <p class="text-muted small mb-0">
                This is the second step to verify your identity.
              </p>
            </div>

            <div class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                for="totpCode"
                >Authenticator Code</label
              >
              <div class="col-md-6">
                <input
                  id="totpCode"
                  v-model="formData.token"
                  autocomplete="one-time-code"
                  autofocus
                  class="form-control text-center otp-input"
                  placeholder="Enter 6-digit code"
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
                  Please provide a valid 6-digit code.
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
                {{ isSubmitting ? "Verifying..." : "Verify" }}
              </button>
              <button
                class="btn btn-link"
                type="button"
                @click="cancelVerification"
              >
                Cancel
              </button>
            </div>

            <div class="text-center text-muted small">
              <p class="mb-0">Codes refresh every 30 seconds.</p>
              <p class="mb-0">
                Make sure your device time is correct if codes are not accepted.
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
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "TwoFactorVerifyTotp",
  components: { IconAsset },
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
              return status === 200 || status === 400 || status === 401;
            },
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.showSuccess = true;
          this.successMessage = "Verification successful! Redirecting...";

          setTimeout(() => {
            this.$router.push(this.$route.query.redirectedFrom || "/dashboard");
          }, 1000);
        } else {
          this.showError = true;
          this.errorMessage =
            response.data.message ||
            "Invalid verification code. Please try again.";
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage =
          error.response?.data?.message ||
          "Failed to verify code. Please try again.";
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

