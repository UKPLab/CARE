<template>
  <form
      class="row g-3 needs-validation"
      novalidate
      @submit.prevent="checkForm"
  >
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
          <div class="card-header d-flex justify-content-between align-items-center">
            Login
            <a
                class="btn btn-sm btn-primary"
                @click="toRegister"
            >Register</a>
          </div>

          <div class="card-body mx-4 my-4">
            <p
                v-if="showError"
                class="text-danger text-center"
            >
              {{ errorMessage }}
            </p>
            <div class="form-group row my-2">
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="username"
              >Username</label>
              <div class="col-md-6">
                <input
                    id="username"
                    v-model="formData.username"
                    autocomplete="username"
                    autofocus
                    class="form-control"
                    placeholder="Username or email"
                    required
                    type="text"
                    @blur="checkVal('username')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['username'] && !validUsername}">
                  Please provide a valid username.
                </div>
              </div>
            </div>


            <div class="form-group row my-2">
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="password"
              >Password</label>
              <div class="col-md-6">
                <input
                    id="password"
                    v-model="formData.password"
                    autocomplete="current-password"
                    class="form-control"
                    name="password"
                    placeholder="Password"
                    required
                    type="password"
                    @blur="checkVal('password')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['password'] && !validPassword}">
                  Please provide a valid password of at least 8 characters.
                </div>
              </div>
            </div>

            <div class="col-md-6 offset-md-4 my-4">
              <button
                  class="btn btn-primary btn-block"
                  type="submit"
              >
                Login
              </button>
              <a
                  v-if="showGuestLogin"
                  class="btn btn-link"
                  @click="login_guest()"
              >Login as Guest</a>
              <a
                class="btn btn-link"
                @click="$refs.forgotPasswordModal.open()"
              >Forgot Password?</a>
            </div>
          </div>
        </div>
        <div
            v-if="showDocs || showFeedback || showProject"
            class="text-center"
        >
          <span v-if="showDocs"><a
              :href="linkDocs"
              target="_blank"
          >Documentation</a></span>
          <span
              v-if="showFeedback && showDocs"
              class="mx-1"
          >&#x2022;</span>
          <span v-if="showFeedback"><a
              :href="linkFeedback"
              target="_blank"
          >Feedback</a></span>
          <span
              v-if="showProject && (showDocs || showFeedback)"
              class="mx-1"
          >&#x2022;</span>
          <span v-if="showProject"><a
              :href="linkProject"
              target="_blank"
          >Project Page</a></span>
        </div>
        <div class="text-center text-secondary">
          {{ copyright }}
        </div>
      </div>
    </div>
  </form>

  <!-- Forgot Password Modal -->
  <BasicModal ref="forgotPasswordModal" name="forgotPasswordModal">
    <template #title>
      Forgot password
    </template>
    <template #body>
      <div class="form-group">
        <label for="resetEmail" class="form-label">Email Address</label>
        <input
          id="resetEmail"
          v-model="forgotPassword.email"
          type="email"
          class="form-control"
          placeholder="Enter your email address"
          required
          :class="{ 'is-invalid': !forgotPasswordValidEmail }"
        >
        <div v-if="!forgotPasswordValidEmail" class="invalid-feedback">
          Please provide a valid email address.
        </div>
        <small class="form-text text-muted">
          We'll send password reset instructions to this email address.
        </small>
      </div>
    </template>
    <template #footer>
      <BasicButton
        v-if="!forgotPassword.success"
        text="Cancel"
        data-bs-dismiss="modal"
      />
      <BasicButton
        v-if="!forgotPassword.success"
        :disabled="!forgotPasswordValidEmail || forgotPassword.isLoading"
        :text="forgotPassword.isLoading ? 'Sending...' : 'Send Reset Email'"
        @click="sendResetEmail"
      >
        <span v-if="forgotPassword.isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
      </BasicButton>
      <BasicButton
        v-if="forgotPassword.success"
        text="Close"
        data-bs-dismiss="modal"
      />
    </template>
  </BasicModal>

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
        text="Close"
        data-bs-dismiss="modal"
      />
      <BasicButton
        v-if="!emailVerification.showSuccess && !emailVerification.showError"
        :disabled="emailVerification.isLoading"
        :text="emailVerification.isLoading ? 'Sending...' : 'Resend Verification Email'"
        @click="resendVerificationEmail"
      >
        <span v-if="emailVerification.isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
      </BasicButton>
      <BasicButton
        v-if="emailVerification.showSuccess"
        text="OK"
        data-bs-dismiss="modal"
      />
    </template>
  </BasicModal>
</template>

<script>
/** Login component
 *
 * This component provides a form to enter user credentials and hereby
 * login on the server. It links to the registration component.
 *
 * @author: Dennis Zyska, Nils Dycke, Carly Gettinger
 */
import IconAsset from "@/basic/icons/IconAsset.vue";
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "AuthLogin",
  components: {IconAsset, BasicModal, BasicButton},
  data() {
    return {
      showError: false,
      errorMessage: "",
      showSuccess: false,
      successMessage: "",
      formData: {
        username: "",
        password: ""
      },
      validity: null,
      forgotPassword: {
        email: "",
        success: false,
        error: false,
        message: "",
        isLoading: false
      },
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
  computed: {
    copyright() {
      return window.config['app.config.copyright'];
    },
    showGuestLogin() {
      return window.config['app.login.guest'] === 'true';
    },
    linkDocs() {
      return window.config['app.landing.linkDocs'];
    },
    showDocs() {
      return window.config['app.landing.showDocs'] === 'true' && this.linkDocs !== '';
    },
    linkFeedback() {
      return window.config['app.landing.linkFeedback'];
    },
    showFeedback() {
      return window.config['app.landing.showFeedback'] === 'true' && this.linkFeedback !== '';
    },
    linkProject() {
      return window.config['app.landing.linkProject'];
    },
    showProject() {
      return window.config['app.landing.showProject'] === 'true' && this.linkProject !== '';
    },
    showForgotPassword() {
      return window.config['app.login.forgotPassword'] === 'true';
    },
    validUsername() {
      return this.formData.username !== "";
    },
    validPassword() {
      return this.formData.password.length >= 8;
    },
    validForm() {
      return this.validUsername && this.validPassword;
    },
    forgotPasswordValidEmail() {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(this.forgotPassword.email);
    }
  },
  beforeMount() {
    this.validity = Object.fromEntries(Object.keys(this.formData).map(key => [key, false]));
  },
  mounted() {
    // Check for query parameters and show appropriate toasts
    // Use nextTick to ensure the component is fully mounted and eventBus is available
    this.$nextTick(() => {
      this.handleQueryParams();
    });
  },
  methods: {
    handleQueryParams() {
      console.log("handleQueryParams called, route query:", this.$route.query);
      console.log("eventBus available:", !!this.eventBus);
      
      // Check for email verification success/failure
      if (this.$route.query.verified === 'true') {
        console.log("Email verified successfully.");
        if (this.eventBus) {
          this.eventBus.emit("toast", {
            title: "Email Verified",
            message: "Your email has been verified successfully. You can now log in.",
            variant: "success",
          });
        }
      }
      else if (this.$route.query.error === "invalid-token") {
        console.log("Email verification failed - invalid token.");
        if (this.eventBus) {
          this.eventBus.emit("toast", {
            title: "Email Verification Failed",
            message: "Email verification failed - the token is invalid or malformed.",
            variant: "danger",
          });
        }
      }
      else if (this.$route.query.error === "expired-token") {
        console.log("Email verification failed - expired token.");
        if (this.eventBus) {
          this.eventBus.emit("toast", {
            title: "Email Verification Failed",
            message: "Email verification failed - the token has expired. Please request a new verification email.",
            variant: "danger",
          });
        }
      }
      else if (this.$route.query.error === "missing-token") {
        console.log("Email verification failed - missing token.");
        if (this.eventBus) {
          this.eventBus.emit("toast", {
            title: "Email Verification Failed",
            message: "Email verification failed - no token provided.",
            variant: "danger",
          });
        }
      }
      else if (this.$route.query.error === "server-error") {
        console.log("Email verification failed - server error.");
        if (this.eventBus) {
          this.eventBus.emit("toast", {
            title: "Email Verification Failed",
            message: "Email verification failed due to a server error. Please try again later.",
            variant: "danger",
          });
        }
      }
      if (this.$route.query.verified || this.$route.query.error) {
        this.$router.replace({ name: this.$route.name });
      }
    },
    checkVal(key) {
      this.validity[key] = true;
    },
    async checkForm() {
      Object.keys(this.validity).map(key => {
        this.validity[key] = true
      })
      if (this.validForm) {
        await this.login_user();
      }
    },
    async login_user() {
      try {
        await this.login({username: this.formData.username, password: this.formData.password})
        {

          await this.$router.go(0);
          this.showError = false;
          
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = error;
      }
    },
    toRegister() {
      this.$router.push({name: "register", query: {redirectedFrom: this.$route.query.redirectedFrom}});
    },
    async login_guest() {
      try {
        await this.login({username: "guest", password: "guestguest"});
        {
          await this.$router.go(0);
          this.showError = false;
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = error;
      }
    },
    async login(credentials) {
      const response = await axios.post(getServerURL() + '/auth/login',
          credentials,
          {
            validateStatus: function (status) {
              return status === 200 || status === 401;
            },
            withCredentials: true
          });
      if (response.status === 401) {
        // Check if the error is due to unverified email
        if (response.data.emailNotVerified) {
          this.showEmailVerificationModal(response.data.email);
        }
        throw response.data.message;
      }
      await this.$router.push(this.$route.query.redirectedFrom || '/dashboard')
    },
    async sendResetEmail() {
      this.forgotPassword.isLoading = true;
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
        this.forgotPassword.message = response.data.message
        this.eventBus.emit("toast", {
          title: "Forgot Password",
          message: response.data.message || this.forgotPassword.message,
          variant: "success",
        });
      } else if (response.status === 401) {
          this.eventBus.emit("toast", {
            title: "Forgot Password Error",
            message: response.data.message ,
            variant: "danger",
          });
          this.forgotPassword.error = true;
          this.forgotPassword.message = response.data.message || "Failed to send password reset email.";
      }
    } catch (error) {
        this.forgotPassword.success = false;
        this.forgotPassword.message = "An unexpected error occurred. Please try again.";
        this.eventBus.emit("toast", {
          title: "Forgot Password Error",
          message: this.forgotPassword.message,
          variant: "danger",
        });
      } finally {
        this.forgotPassword.isLoading = false;
      }
    },
    showEmailVerificationModal(email) {
      this.emailVerification.email = email;
      this.emailVerification.showSuccess = false;
      this.emailVerification.showError = false;
      this.emailVerification.successMessage = "";
      this.emailVerification.errorMessage = "";
      this.$refs.emailVerificationModal.open();
    },
    async resendVerificationEmail() {
      this.emailVerification.isLoading = true;
      this.emailVerification.showSuccess = false;
      this.emailVerification.showError = false;
      
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
        console.error('Resend verification email error:', error);
      } finally {
        this.emailVerification.isLoading = false;
      }
    }
  }
}
</script>

<style scoped>
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