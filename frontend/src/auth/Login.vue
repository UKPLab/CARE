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
          <LogoSvg
              :height="200"
          />
        </div>

        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            {{ $t('auth.login') }}
            <a
              v-if="showRegisterButton"
              class="btn btn-sm btn-primary"
              @click="toRegister"
            >{{ $t('auth.register') }}</a>
          </div>

          <div class="card-body mx-4 my-4">
            <p
                v-if="showError"
                class="text-danger text-center"
            >
              {{ errorMessage }}
            </p>
            <AuthInputField
              v-model="formData.username" :label="$t('auth.username')"
              :input="{ id: 'username',  type: 'text',
                autocomplete: 'username', autofocus: true, required: true,
                placeholder: $t('auth.usernameOrEmail') }"
              :invalid="validity.username && !validUsername" @blur="checkVal('username')"
            >{{ $t('errors.validation.auth.provideUsername') }}</AuthInputField>
            <AuthInputField
              v-model="formData.password" :label="$t('auth.password')"
              :input="{ id: 'password', name: 'password', type: 'password',
                autocomplete: 'current-password',  required: true,
                placeholder: $t('auth.password') }"
              :invalid="validity.password && !validPassword" @blur="checkVal('password')"
            >{{ $t('errors.validation.auth.providePassword') }}</AuthInputField>
            <div class="col-md-6 offset-md-4 my-4">
              <BasicButton
                  class="btn btn-primary btn-block"
                  type="submit"
                  :loading="isSubmitting"
                  :text="isSubmitting ? $t('auth.signingIn') : $t('auth.login')"
              />
              <a
                  v-if="showGuestLogin"
                  class="btn btn-link"
                  @click="login_guest()"
              >{{ $t('auth.loginAsGuest') }}</a>
              <a
                v-if="showForgotPassword"
                class="btn btn-link"
                @click="$refs.forgotPasswordModal.open()"
              >{{ $t('auth.forgotPassword') }}</a>
            </div>

            <ExternalLoginOptions />          </div>
        </div>
        <AuthLinksFooter />
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
import LogoSvg from "@/basic/icon/LogoSvg.vue";
import BasicButton from "@/basic/Button.vue";
import ForgotPasswordModal from "@/auth/ForgotPasswordModal.vue";
import EmailVerificationModal from "@/auth/EmailVerificationModal.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

import AuthLinksFooter from './AuthLinksFooter.vue';
import ExternalLoginOptions from './ExternalLoginOptions.vue';

import AuthInputField from "./AuthInputField.vue";

export default {
  name: "AuthLogin",
  components: {AuthInputField,AuthLinksFooter, ExternalLoginOptions,LogoSvg, BasicButton, ForgotPasswordModal, EmailVerificationModal},
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
      isSubmitting: false,
    }
  },
  computed: {

    showGuestLogin() {
      return window.config['app.login.guest'] === 'true';
    },

    showForgotPassword() {
      return window.config['app.login.forgotPassword'] === 'true';
    },
    showRegisterButton() {
      return window.config['app.register.enabled'] === 'true';
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
      this.checkSelfRegistration();
    });
  },
  methods: {
    handleQueryParams() {
      if (this.$route.query.error) {
        this.showError = true;
        this.errorMessage = this.mapAuthErrorCode(this.$route.query.error);
      }
      if (this.$route.query.token) {
        this.verifyEmail(this.$route.query.token);
      }
      const query = {};
      if (this.$route.query.redirectedFrom) {
        query.redirectedFrom = this.$route.query.redirectedFrom;
      }
      this.$router.replace({ name: this.$route.name, query });
    },
    mapAuthErrorCode(errorCode) {
      const mapping = {
        "twofactor-session-save-failed": "errors.auth.twoFactorSessionSaveFailed",
        "unsupported-2fa-method": "errors.auth.unsupported2FAMethod",
        "orcid-login-disabled": "errors.auth.orcidLoginDisabled",
        "orcid-login-not-ready": "errors.auth.orcidLoginNotReady",
        "orcid-login-failed": "errors.auth.orcidLoginFailed",
        "saml-login-disabled": "errors.auth.samlLoginDisabled",
        "saml-login-not-ready": "errors.auth.samlLoginNotReady",
        "saml-login-failed": "errors.auth.samlLoginFailed",
      };

      return this.$t(mapping[errorCode] || "errors.auth.loginFailed");
    },
    checkSelfRegistration() {
      if (this.$route.query.registrationDisabled === "true") {
        this.eventBus.emit("toast", {
          message: this.$t('auth.messages.selfRegistrationDisabledMessage'),
          title: this.$t('auth.messages.registrationDisabled'),
          variant: "warning"
        });
        // Clean up query parameter
        this.$router.replace({ name: "login", query: { redirectedFrom: this.$route.query.redirectedFrom } });
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
      this.isSubmitting = true;
      try {
        const loginResult = await this.login({
          username: this.formData.username,
          password: this.formData.password,
        });

        if (loginResult?.completedLogin) {
          // TODO: May need to figure out another way to fix old user data persisting issue.
          await this.$router.go(0);
          this.showError = false;
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = error;
      } finally {
        this.isSubmitting = false;
      }
    },
    toRegister() {
      this.$router.push({name: "register", query: {redirectedFrom: this.$route.query.redirectedFrom}});
    },
    async login_guest() {
      try {
        const loginResult = await this.login({
          username: "guest",
          password: "guestguest",
        });

        if (loginResult?.completedLogin) {
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
          {
            ...credentials,
            redirectedFrom: this.$route.query.redirectedFrom,
          },
          {
            validateStatus: function (status) {
              return status === 200 || status === 400 || status === 401;
            },
            withCredentials: true
          });
      if (response.status === 400 || response.status === 401) {
        // Check if the error is due to unverified email
        if (response.data.emailNotVerified) {
          this.showEmailVerificationModal(response.data.email);
        }
        throw resolveApiMessage(response.data, "errors.auth.invalidCredentials");
      }

      // Check if 2FA is required
      if (response.status === 200) {
        if (response.data.requiresTwoFactor) {
          const { method, methods, selectionRequired } = response.data;
          // If multiple methods are enabled, let the user choose
          if (selectionRequired) {
            await this.$router.push({
              name: "2fa-select",
              query: {
                methods: Array.isArray(methods) ? methods.join(",") : "",
                redirectedFrom: this.$route.query.redirectedFrom
              }
            });
            return { completedLogin: false };
          }

          const verificationRoutes = { email: '2fa-verify-email', totp: '2fa-verify-totp' };
          if (verificationRoutes[method]) {
            await this.$router.push({
              name: verificationRoutes[method],
              query: { redirectedFrom: this.$route.query.redirectedFrom },
            });
            return { completedLogin: false };
          }
          // Unknown method: surface a clear error
          this.showError = true;
          this.errorMessage = this.$t('errors.auth.unsupported2FAMethod');
          return { completedLogin: false };
        }
        // Normal login flow (no 2FA)
        await this.$router.push(this.$route.query.redirectedFrom || '/dashboard')
        return { completedLogin: true };
      }
    },

    showEmailVerificationModal(email) {
      this.$refs.emailVerificationModal.open(email);
    },
    verifyEmail(token) {
      return this.$refs.emailVerificationModal.verifyEmail(token);
    },

  }
}
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
  border: 1px solid var(--bs-border-color, #ced4da);
  border-radius: 0.25rem;
}
</style>
