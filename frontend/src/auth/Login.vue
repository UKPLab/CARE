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
            <div class="form-group row my-2">
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="username"
              >{{ $t('auth.username') }}</label>
              <div class="col-md-6">
                <input
                    id="username"
                    v-model="formData.username"
                    autocomplete="username"
                    autofocus
                    class="form-control"
                    :placeholder="$t('auth.usernameOrEmail')"
                    required
                    type="text"
                    @blur="checkVal('username')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['username'] && !validUsername}">
                  {{ $t('errors.validation.auth.provideUsername') }}
                </div>
              </div>
            </div>


            <div class="form-group row my-2">
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="password"
              >{{ $t('auth.password') }}</label>
              <div class="col-md-6">
                <input
                    id="password"
                    v-model="formData.password"
                    autocomplete="current-password"
                    class="form-control"
                    name="password"
                    :placeholder="$t('auth.password')"
                    required
                    type="password"
                    @blur="checkVal('password')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['password'] && !validPassword}">
                  {{ $t('errors.validation.auth.providePassword') }}
                </div>
              </div>
            </div>

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

            <hr v-if="showExternalLoginOptions">

            <div v-if="showExternalLoginOptions" class="col-md-8 offset-md-2 mt-3">
              <p class="text-center text-muted small mb-2">
                {{ $t('auth.orSignInWith') }}
              </p>
              <div class="d-grid gap-2">
                <BasicButton
                  v-if="showOrcidLogin"
                  class="btn btn-outline-success btn-block"
                  text="ORCID"
                  @click="loginWithOrcid"
                />
                <BasicButton
                  v-if="showLdapLogin"
                  class="btn btn-outline-secondary btn-block"
                  text="LDAP"
                  @click="toLdapLogin"
                />
                <BasicButton
                  v-if="showSamlLogin"
                  class="btn btn-outline-dark btn-block"
                  text="SSO"
                  @click="loginWithSaml"
                />
              </div>
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
          >{{ $t('navigation.documentation') }}</a></span>
          <span
              v-if="showFeedback && showDocs"
              class="mx-1"
          >&#x2022;</span>
          <span v-if="showFeedback"><a
              :href="linkFeedback"
              target="_blank"
          >{{ $t('navigation.feedback') }}</a></span>
          <span
              v-if="showProject && (showDocs || showFeedback)"
              class="mx-1"
          >&#x2022;</span>
          <span v-if="showProject"><a
              :href="linkProject"
              target="_blank"
          >{{ $t('navigation.projectPage') }}</a></span>
        </div>
        <div class="text-center text-secondary">
          {{ copyright }}
        </div>
        <div v-if="showVersion" class="text-center text-secondary">
          {{ $t('common.appVersion') }}: {{ version }}
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
import LogoSvg from "@/basic/icon/LogoSvg.vue";
import BasicButton from "@/basic/Button.vue";
import ForgotPasswordModal from "@/auth/ForgotPasswordModal.vue";
import EmailVerificationModal from "@/auth/EmailVerificationModal.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AuthLogin",
  components: {LogoSvg, BasicButton, ForgotPasswordModal, EmailVerificationModal},
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
      version: APP_VERSION,
      showVersion: (process.env.NODE_ENV !== 'production'),
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
    showRegisterButton() {
      return window.config['app.register.enabled'] === 'true';
    },
    showOrcidLogin() {
      return window.config['system.auth.orcid.enabled'] === 'true';
    },
    showLdapLogin() {
      return window.config['system.auth.ldap.enabled'] === 'true';
    },
    showSamlLogin() {
      return window.config['system.auth.saml.enabled'] === 'true';
    },
    showExternalLoginOptions() {
      return this.showOrcidLogin || this.showLdapLogin || this.showSamlLogin;
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

          // Single method, go directly to corresponding verification
          if (method === "email") {
            await this.$router.push({
              name: "2fa-verify-email",
              query: {
                redirectedFrom: this.$route.query.redirectedFrom
              }
            });
            return { completedLogin: false };
          }

          if (method === "totp") {
            await this.$router.push({
              name: "2fa-verify-totp",
              query: {
                redirectedFrom: this.$route.query.redirectedFrom
              }
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
    loginWithOrcid() {
      const redirectedFrom = this.$route.query.redirectedFrom;
      const query = redirectedFrom ? `?redirectedFrom=${encodeURIComponent(redirectedFrom)}`: "";
      window.location.href = getServerURL() + "/auth/login/orcid" + query;
    },
    loginWithSaml() {
      const redirectedFrom = this.$route.query.redirectedFrom;
      const query = redirectedFrom ? `?redirectedFrom=${encodeURIComponent(redirectedFrom)}`: "";
      window.location.href = getServerURL() + "/auth/login/saml" + query;
    },
    toLdapLogin() {
      this.$router.push({
        name: "login-ldap",
        query: { redirectedFrom: this.$route.query.redirectedFrom },
      });
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
            title: this.$t('auth.messages.emailVerified'),
            message: resolveApiMessage(response.data, "auth.messages.emailVerifiedSuccess"),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('errors.auth.emailVerificationError'),
            message: resolveApiMessage(response.data, "errors.auth.failedToVerifyEmail"),
            variant: "danger",
          });
        }
      } catch (_error) {
        this.eventBus.emit("toast", {
          title: this.$t('errors.auth.emailVerificationError'),
          message: this.$t('errors.auth.failedToVerifyEmail'),
          variant: "danger",
        });
      }
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
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
}

</style>
