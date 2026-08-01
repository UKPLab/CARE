<template>
  <!-- Email Verification Modal -->
  <BasicModal ref="emailVerificationModal" name="emailVerificationModal">
    <template #title>
      {{ $t('auth.emailVerificationRequired') }}
    </template>
    <template #body>
      <div v-if="!emailVerification.showSuccess && !emailVerification.showError">
        <p>{{ $t('auth.messages.emailNotVerified') }}</p>
        <p>{{ $t('auth.messages.resendVerificationPrompt') }}</p>
      </div>
      <div v-if="emailVerification.showSuccess" class="alert alert-success">
        {{ emailVerification.successMessage }}
      </div>
      <div v-if="emailVerification.showError" class="alert alert-danger">
        {{ emailVerification.errorMessage }}
      </div>
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton
          v-if="!emailVerification.showSuccess"
          class="btn btn-secondary"
          :text="$t('common.close')"
          data-bs-dismiss="modal"
        />
        <BasicButton
          v-if="!emailVerification.showSuccess && !emailVerification.showError"
          :loading="emailVerification.isLoading"
          class="btn btn-primary"
          :text="emailVerification.isLoading ? $t('modals.sending') : $t('auth.resendVerificationEmail')"
          @click="resendVerificationEmail"
        />
        <BasicButton
          v-if="emailVerification.showSuccess"
          class="btn btn-success"
          :text="$t('common.ok')"
          data-bs-dismiss="modal"
        />
      </div>
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
import { resolveApiMessage } from "@/assets/utils";

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
          this.emailVerification.successMessage = resolveApiMessage(response.data, 'auth.messages.verificationEmailSent');
        } else {
          this.emailVerification.showError = true;
          this.emailVerification.errorMessage = resolveApiMessage(response.data, 'errors.auth.failedToSendVerificationEmail');
        }
      } catch (_error) {
        this.emailVerification.showError = true;
        this.emailVerification.errorMessage = this.$t('errors.server.unexpectedError');
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