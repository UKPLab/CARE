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

  <!-- Forgot Password Modal Component -->
  <ForgotPasswordModal ref="forgotPasswordModal" />

  <!-- Email Verification Modal Component -->
  <EmailVerificationModal ref="emailVerificationModal" />
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
import ForgotPasswordModal from "@/auth/ForgotPasswordModal.vue";
import EmailVerificationModal from "@/auth/EmailVerificationModal.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "AuthLogin",
  components: {IconAsset, ForgotPasswordModal, EmailVerificationModal},
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
      validity: null
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
      if (this.$route.query.token) {
        this.verifyEmail(this.$route.query.token);
      }
      this.$router.replace({ name: this.$route.name });
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

    showEmailVerificationModal(email) {
      this.$refs.emailVerificationModal.open(email);
    },
    async verifyEmail(token) {
      try {
        const response = await axios.get(getServerURL() + '/verify-email?token=' + token,
          {
            validateStatus: function (status) {
              return status === 200 || status === 400 || status === 500;
            },
          }
        );
        if (response.status === 200) {
          this.eventBus.emit("toast", {
            title: "Email Verified",
            message: response.data.message || "Your email has been successfully verified. You can now log in.",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Email Verification Error",
            message: response.data.message || "Failed to verify email.",
            variant: "danger",
          });
        }
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Email Verification Error",
          message: "Failed to verify email. Please try again later.",
          variant: "danger",
        });
      }
    },

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