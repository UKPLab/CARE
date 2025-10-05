<template>
  <!-- Forgot Password Modal -->
  <BasicModal ref="forgotPasswordModal" name="forgotPasswordModal">
    <template #title>
      Forgot password
    </template>
    <template #body>
      <div v-if="!forgotPassword.success">
        <div class="form-group">
          <label for="resetEmail" class="form-label">Email Address</label>
          <input
            id="resetEmail"
            v-model="forgotPassword.email"
            type="email"
            class="form-control"
            placeholder="Enter your email address"
            required
            :class="{ 'is-invalid': !forgotPasswordValidEmail && forgotPassword.email.length > 0 }"
          >
          <div v-if="!forgotPasswordValidEmail && forgotPassword.email.length > 0" class="invalid-feedback">
            Please provide a valid email address.
          </div>
          <small class="form-text text-muted">
            We'll send password reset instructions to this email address.
          </small>
        </div>
      </div>
      <div v-if="forgotPassword.success" class="alert alert-success">
        <i class="bi bi-check-circle me-2"></i>
        {{ forgotPassword.message }}
      </div>
      <div v-if="forgotPassword.error" class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ forgotPassword.message }}
      </div>
    </template>
    <template #footer>
      <BasicButton
        v-if="!forgotPassword.success"
        text="Cancel"
        class="btn btn-secondary"
        data-bs-dismiss="modal"
        @click="resetForm"
      />
      <BasicButton
        v-if="!forgotPassword.success"
        :disabled="!forgotPasswordValidEmail || forgotPassword.isLoading"
        class="btn btn-primary"
        :text="forgotPassword.isLoading ? 'Sending...' : 'Send Reset Email'"
        @click="sendResetEmail"
      >
        <span v-if="forgotPassword.isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
      </BasicButton>
      <BasicButton
        v-if="forgotPassword.success"
        text="Close"
        class="btn btn-success"
        data-bs-dismiss="modal"
        @click="resetForm"
      />
    </template>
  </BasicModal>
</template>

<script>
/** Forgot Password Modal Component
 *
 * This component provides a modal for password reset functionality,
 * allowing users to request password reset emails.
 *
 * @author: Karim Ouf
 */
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "ForgotPasswordModal",
  components: { BasicModal, BasicButton },
  data() {
    return {
      forgotPassword: {
        email: "",
        success: false,
        error: false,
        message: "",
        isLoading: false
      }
    }
  },
  computed: {
    /**
     * Validate email format
     * @returns {boolean} - Whether the email is valid
     */
    forgotPasswordValidEmail() {
      const emailRegEx = new RegExp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
      return emailRegEx.test(this.forgotPassword.email);
    }
  },
  methods: {
    /**
     * Open the forgot password modal
     */
    open() {
      this.resetForm();
      this.$refs.forgotPasswordModal.open();
    },

    /**
     * Close the forgot password modal
     */
    close() {
      this.$refs.forgotPasswordModal.close();
    },

    /**
     * Reset the form to initial state
     */
    resetForm() {
      this.forgotPassword = {
        email: "",
        success: false,
        error: false,
        message: "",
        isLoading: false
      };
    },

    /**
     * Send password reset email
     */
    async sendResetEmail() {
      this.forgotPassword.isLoading = true;
      this.forgotPassword.error = false;
      this.forgotPassword.message = "";

      try {
        const response = await axios.post(getServerURL() + '/auth/request-password-reset',
          { email: this.forgotPassword.email },
          {
            validateStatus: function (status) {
              return status === 200 || status === 400 || status === 500 || status === 401;
            },
            withCredentials: true
          }
        );

        if (response.status === 200) {
          this.forgotPassword.success = true;
          this.forgotPassword.message = response.data.message || "Password reset link has been sent to your email address.";
          
          // Emit success event for parent components to handle
          this.$emit('reset-email-sent', {
            email: this.forgotPassword.email,
            message: this.forgotPassword.message
          });

          // Show toast notification if eventBus is available
          if (this.eventBus) {
            this.eventBus.emit("toast", {
              title: "Password Reset",
              message: this.forgotPassword.message,
              variant: "success",
            });
          }
        } else {
          this.forgotPassword.error = true;
          this.forgotPassword.message = response.data.message || "Failed to send password reset email.";
          
          // Emit error event for parent components to handle
          this.$emit('reset-email-error', {
            email: this.forgotPassword.email,
            message: this.forgotPassword.message
          });

          // Show toast notification if eventBus is available
          if (this.eventBus) {
            this.eventBus.emit("toast", {
              title: "Password Reset Error",
              message: this.forgotPassword.message,
              variant: "danger",
            });
          }
        }
      } catch (error) {
        this.forgotPassword.error = true;
        this.forgotPassword.message = "An unexpected error occurred. Please try again.";
        
        // Emit error event for parent components to handle
        this.$emit('reset-email-error', {
          email: this.forgotPassword.email,
          message: this.forgotPassword.message
        });

        // Show toast notification if eventBus is available
        if (this.eventBus) {
          this.eventBus.emit("toast", {
            title: "Password Reset Error",
            message: this.forgotPassword.message,
            variant: "danger",
          });
        }
      } finally {
        this.forgotPassword.isLoading = false;
      }
    }
  }
}
</script>

<style scoped>
/* Custom styles for the forgot password modal */
.form-group {
  margin-bottom: 1rem;
}

.alert {
  margin-bottom: 0;
}

.alert i {
  font-size: 1.1em;
}

/* Focus styles for better accessibility */
input:focus {
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

/* Custom validation styles */
.is-invalid {
  border-color: #dc3545;
}

.is-invalid:focus {
  border-color: #dc3545;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
}
</style>