<template>
  <div class="row g-3">
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div
            class="text-center"
            style="margin-bottom: 20px"
        >
          <LogoSvg
              :height="200"
          />
        </div>

        <div class="card">
          <div class="card-header">
            {{ $t('auth.resetPassword') }}
          </div>

          <div class="card-body mx-4 my-4">
            <!-- Loading State -->
            <div v-if="validatingToken" class="text-center">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">{{ $t('common.loading') }}</span>
              </div>
              <p class="mt-3">{{ $t('auth.messages.validatingResetToken') }}</p>
            </div>

            <!-- Error State -->
            <p
                v-if="showError"
                :class="isSuccess ? 'text-success' : 'text-danger'"
                class="text-center"
            >
              {{ errorMessage }}
            </p>
            
            <!-- Form - only show when token is validated and not successful yet -->
            <div v-if="!isSuccess && tokenValidated && !validatingToken">
              <BasicForm
                ref="resetForm"
                v-model="formData"
                :fields="fields"
              />
            </div>

              <BasicButton
                  v-if="!isSuccess && tokenValidated && !validatingToken"
                  class="btn btn-primary w-full max-w-xs mt-4 "
                  :text="$t('auth.resetPassword')"
                  @click="checkForm"
              />

              <BasicButton
                  v-if="isSuccess || (showError && !tokenValidated && !validatingToken)"
                  :class="isSuccess ? 'btn btn-success w-full max-w-xs' : 'btn btn-secondary w-full max-w-xs'"
                  :text="isSuccess ? $t('auth.returnToLogin') : $t('auth.backToLogin')"
                  @click="toLogin"
              />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/** Reset Password component
 *
 * This component provides a form to reset user password using a reset token
 * Now uses BasicForm for consistent form handling across the application
 *
 * @author: Karim Ouf
 */
import LogoSvg from "@/basic/icon/LogoSvg.vue";
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AuthResetPassword",
  components: {LogoSvg, BasicForm, BasicButton},
  data() {
    return {
      showError: false,
      errorMessage: "",
      isSuccess: false,
      tokenValidated: false,
      validatingToken: true,
      formData: {
        newPassword: "",
        confirmPassword: ""
      },
    }
  },
  computed: {
    fields() {
      return [
        {
          key: "newPassword",
          type: "password",
          required: true,
          placeholder: this.$t('auth.placeholders.newPasswordPlaceholder'),
          invalidText: this.$t('errors.validation.auth.passwordMinLength'),
          pattern: ".{8,}",
          default: "",
          size: 12,
        },
        {
          key: "confirmPassword",
          type: "password",
          required: true,
          placeholder: this.$t('auth.placeholders.confirmPasswordPlaceholder'),
          invalidText: this.$t('errors.validation.auth.passwordsDoNotMatch'),
          pattern: ".{8,}",
          default: "",
          size: 12,
        }
      ];
    },
    resetToken() {
      return this.$route.query.token;
    },
    validPassword() {
      const p = this.formData.newPassword || "";
      return p.length >= 8
        && !/^\s*$/.test(p)
        && ![...p].some((c) => {
          const codePoint = c.codePointAt(0) || 0;
          return codePoint <= 31 || codePoint === 127;
        })
        && ![...p].some((c) => (c.codePointAt(0) || 0) > 0xFFFF);
    },
    validConfirmPassword() {
      return this.formData.newPassword === this.formData.confirmPassword;
    },
    validForm() {
      return this.validPassword && this.validConfirmPassword;
    }
  },
  async beforeMount() {
    // Check if token is present
    if (!this.resetToken) {
      this.showError = true;
      this.errorMessage = this.$t('errors.auth.invalidResetLink');
      this.validatingToken = false;
      return;
    }
    
    // Validate token using axios call
    await this.validateResetToken();
  },
  methods: {
    async validateResetToken() {
      try {
        // Check if the token exists and is valid
        const response = await axios.get(getServerURL() + '/auth/check-reset-token', {
          params: { token: this.resetToken },
          validateStatus: function (status) {
            return status === 200 || status === 400 || status === 404;
          }
        });
        
        if (response.status === 200) {
          this.tokenValidated = true;
        } else {
          this.showError = true;
          this.errorMessage = resolveApiMessage(response.data, 'errors.auth.invalidOrExpiredToken');
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = this.$t('errors.auth.failedToValidateToken');
        console.error('Token validation error:', error);
      } finally {
        this.validatingToken = false;
      }
    },
    async checkForm() {
      // Ensure token is validated first
      if (!this.tokenValidated) {
        this.showError = true;
        this.errorMessage = this.$t('errors.auth.invalidResetToken');
        return;
      }
      
      // Validate using BasicForm's validation
      if (this.$refs.resetForm && this.$refs.resetForm.validate) {
        if (!this.$refs.resetForm.validate()) {
          this.showError = true;
          this.errorMessage = this.$t('errors.validation.ensurePasswordRequirements');
          return;
        }
      }
      
      // Additional custom validation
      if (this.validForm && this.resetToken) {
        await this.resetPassword();
      } else {
        this.showError = true;
        this.errorMessage = this.$t('errors.validation.fillAllFields');
      }
    },
    async resetPassword() {
      try {
        const response = await axios.post(getServerURL() + '/auth/reset-password', 
          { 
            token: this.resetToken,
            newPassword: this.formData.newPassword
          },
          {
            validateStatus: function (status) {
              return status === 200 || status === 400 || status === 500;
            },
            withCredentials: true
          }
        );

        if (response.status === 200) {
          
          this.isSuccess = true;
          this.showError = true; // Using this to show success message
          this.errorMessage = resolveApiMessage(response.data, 'auth.messages.passwordResetSuccess');
        } else {
          this.showError = true;
          this.errorMessage = resolveApiMessage(response.data, 'errors.auth.failedToResetPassword');
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = this.$t('errors.auth.failedToResetPassword');
        console.error('Reset password error:', error);
      }
    },
    toLogin() {
      this.$router.push({name: "login"});
    }
  }
}
</script>

<style scoped>
/* BasicForm handles most styling, only custom styles needed here */
.text-center {
  text-align: center;
}
</style>
