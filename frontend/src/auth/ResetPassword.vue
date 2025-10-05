<template>
  <div class="row g-3">
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div
            class="text-center"
            style="margin-bottom: 20px"
        >
          <IconAsset
              :height="200"
              name="logo"
          />
        </div>

        <div class="card">
          <div class="card-header">
            Reset Password
          </div>

          <div class="card-body mx-4 my-4">
            <!-- Loading State -->
            <div v-if="validatingToken" class="text-center">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-3">Validating reset token...</p>
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
                v-model="formData"
                :fields="fields"
                ref="resetForm"
              />
            </div>

              <BasicButton
                  v-if="!isSuccess && tokenValidated && !validatingToken"
                  class="btn btn-primary w-full max-w-xs mt-4 "
                  text="Reset Password"
                  @click="checkForm"
              />

              <BasicButton
                  v-if="isSuccess || (showError && !tokenValidated && !validatingToken)"
                  :class="isSuccess ? 'btn btn-success w-full max-w-xs' : 'btn btn-secondary w-full max-w-xs'"
                  @click="toLogin"
                  :text="isSuccess ? 'Return to Login' : 'Back to Login'"
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
import IconAsset from "@/basic/icon/IconAsset.vue";
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "AuthResetPassword",
  components: {IconAsset, BasicForm, BasicButton},
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
      fields: [
        {
          key: "newPassword",
          type: "password",
          required: true,
          placeholder: "Enter new password (minimum 8 characters)",
          invalidText: "Password must be at least 8 characters long.",
          pattern: ".{8,}",
          default: "",
          size: 12,
        },
        {
          key: "confirmPassword",
          type: "password",
          required: true,
          placeholder: "Confirm new password",
          invalidText: "Passwords do not match.",
          pattern: ".{8,}",
          default: "",
          size: 12,
        }
      ],
    }
  },
  computed: {
    resetToken() {
      return this.$route.query.token;
    },
    validPassword() {
      return this.formData.newPassword && this.formData.newPassword.length >= 8;
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
      this.errorMessage = "Invalid reset link. Please request a new password reset.";
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
          this.errorMessage = response.data.message || "Invalid or expired reset token.";
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = "Failed to validate reset token. Please try again.";
        console.error('Token validation error:', error);
      } finally {
        this.validatingToken = false;
      }
    },
    async checkForm() {
      // Ensure token is validated first
      if (!this.tokenValidated) {
        this.showError = true;
        this.errorMessage = "Invalid reset token. Please request a new password reset.";
        return;
      }
      
      // Validate using BasicForm's validation
      if (this.$refs.resetForm && this.$refs.resetForm.validate) {
        if (!this.$refs.resetForm.validate()) {
          this.showError = true;
          this.errorMessage = "Please ensure passwords meet the requirements.";
          return;
        }
      }
      
      // Additional custom validation
      if (this.validForm && this.resetToken) {
        await this.resetPassword();
      } else {
        this.showError = true;
        this.errorMessage = "Please fill in all fields correctly.";
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
          this.errorMessage = "Password has been successfully reset. You can now login with your new password.";
        } else {
          this.showError = true;
          this.errorMessage = response.data.message || "Failed to reset password.";
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = "Failed to reset password. Please try again later.";
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
