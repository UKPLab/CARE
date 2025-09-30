<template>
  <!-- Email Verification Modal -->
  <BasicModal ref="emailVerificationModal" name="emailVerificationModal">
    <template #title>
      Email Verification Required
    </template>
    <template #body>
      <div v-if="!emailVerification.showSuccess && !emailVerification.showError">
        <p>Your email address has not been verified yet. Please check your email for a verification link.</p>
        <p><strong>Email:</strong> {{ emailVerification.email }}</p>
        <p>Didn't receive the email? Click below to send a new verification email.</p>
      </div>
      <div v-if="emailVerification.showSuccess" class="alert alert-success">
        {{ emailVerification.successMessage }}
      </div>
      <div v-if="emailVerification.showError" class="alert alert-danger">
        {{ emailVerification.errorMessage }}
      </div>
    </template>
    <template #footer>
      <BasicButton
        v-if="!emailVerification.showSuccess"
        class="btn btn-secondary"
        text="Close"
        data-bs-dismiss="modal"
      />
      <BasicButton
        v-if="!emailVerification.showSuccess && !emailVerification.showError"
        :disabled="emailVerification.isLoading"
        class="btn btn-primary"
        :text="emailVerification.isLoading ? 'Sending...' : 'Resend Verification Email'"
        @click="resendVerificationEmail"
      >
        <span v-if="emailVerification.isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
      </BasicButton>
      <BasicButton
        v-if="emailVerification.showSuccess"
        class="btn btn-success"
        text="OK"
        data-bs-dismiss="modal"
      />
    </template>
  </BasicModal>
</template>

<script>
/** Email Verification Modal Component
 *
 * This component provides a modal for email verification functionality,
 * allowing users to resend verification emails when needed.
 *
 * @author: Karim Ouf
 */
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "EmailVerificationModal",
  components: { BasicModal, BasicButton },
  data() {
    return {
      emailVerification: {
        email: "",
        showSuccess: false,
        showError: false,
        successMessage: "",
        errorMessage: "",
        isLoading: false
      }
    }
  },
  methods: {
    /**
     * Open the email verification modal with the provided email
     * @param {string} email - The email address to verify
     */
    open(email) {
      this.emailVerification.email = email;
      this.emailVerification.showSuccess = false;
      this.emailVerification.showError = false;
      this.emailVerification.successMessage = "";
      this.emailVerification.errorMessage = "";
      this.emailVerification.isLoading = false;
      this.$refs.emailVerificationModal.open();
    },

    /**
     * Close the email verification modal
     */
    close() {
      this.$refs.emailVerificationModal.close();
    },

    /**
     * Resend verification email to the user
     */
    async resendVerificationEmail() {
      this.emailVerification.isLoading = true;
      try {
        const response = await axios.post(getServerURL() + '/auth/resend-verification',
          { email: this.emailVerification.email },
          {
            validateStatus: function (status) {
              return status === 200 || status === 400 || status === 500;
            },
            withCredentials: true
          }
        );
        
        if (response.status === 200) {
          this.emailVerification.showSuccess = true;
          this.emailVerification.successMessage = response.data.message || "Verification email has been sent successfully.";
        } else {
          this.emailVerification.showError = true;
          this.emailVerification.errorMessage = response.data.message || "Failed to send verification email.";
        }
      } catch (error) {
        this.emailVerification.showError = true;
        this.emailVerification.errorMessage = "An unexpected error occurred. Please try again.";
      } finally {
        this.emailVerification.isLoading = false;
      }
    }
  }
}
</script>

<style scoped>
/* Add any specific styles for the email verification modal here */
</style>