<template>
  <form
      ref="registerForm"
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
            {{ $t('auth.register') }}
            <a
                class="btn btn-sm btn-primary"
                href="#"
                @click="toLogin"
            >{{ $t('auth.login') }}</a>
          </div>

          <div class="card-body mx-4 my-4">
            <div
                v-if="config['requestName']"
                class="form-group row my-2"
            >
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="firstName"
              >{{ $t('auth.firstName') }}</label>
              <div class="col-md-6">
                <input
                    id="firstName"
                    v-model="formData['firstName']"
                    autofocus
                    class="form-control"
                    name="firstName"
                    required
                    type="text"
                >
                <div class="feedback-invalid">
                  {{ $t('errors.validation.auth.provideFirstName') }}
                </div>
              </div>
            </div>


            <div
                v-if="config['requestName']"
                class="form-group row my-2"
            >
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="lastName"
              >{{ $t('auth.lastName') }}</label>
              <div class="col-md-6">
                <input
                    id="lastName"
                    v-model="formData['lastName']"
                    class="form-control"
                    name="lastName"
                    required
                    type="text"
                >
                <div class="feedback-invalid">
                  {{ $t('errors.validation.auth.provideLastName') }}
                </div>
              </div>
            </div>

            <div class="form-group row my-2">
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="userName"
              >{{ $t('auth.username') }}</label>
              <div class="col-md-6">
                <input
                    id="userName"
                    v-model="formData['userName']"
                    class="form-control"
                    name="userName"
                    pattern="^[a-zA-Z0-9]+$"
                    required
                    type="text"
                    @blur="checkVal('userName')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['userName'] && !validUsername}">
                  {{ $t('errors.validation.auth.usernameNoSpecialChars') }}
                </div>
              </div>
            </div>

            <div class="form-group row my-2">
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="email"
              >{{ $t('auth.email') }}</label>
              <div class="col-md-6">
                <input
                    id="email"
                    v-model="formData['email']"
                    class="form-control"
                    name="email"
                    required
                    type="email"
                    @blur="checkVal('email')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['email'] && !validEmail}">
                  {{ $t('errors.validation.auth.provideEmail') }}
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
                    v-model="formData['password']"
                    class="form-control"
                    name="password"
                    pattern=".{8,}"
                    required
                    type="password"
                    @blur="checkVal('password')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['password'] && !validPassword}">
                  {{ $t('errors.validation.auth.passwordRequirements') }}
                </div>
              </div>
            </div>


            <div class="form-group row my-2">
              <div class="col-md-6 offset-md-4">
                <label>
                  <input
                      v-model="formData['acceptTerms']"
                      name="acceptTerms"
                      type="checkbox"
                      @blur="checkVal('acceptTerms')"
                  > {{ $t('auth.acceptTermsPrefix') }} <a
                    href="#"
                    @click="$refs.terms.open()"
                  >{{ $t('auth.termsOfService') }}</a>
                  <div class="feedback-invalid" :class="{invalid: validity['acceptTerms'] && !validTerms}"
                    >{{ $t('errors.validation.auth.acceptTermsRequired') }}
                  </div>
                </label>
              </div>
            </div>
            <div
                v-if="config['requestStats']"
                class="form-group row my-2"
            >
              <div class="col-md-6 offset-md-4">
                <label>
                  <input
                      v-model="formData['acceptStats']"
                      name="acceptStats"
                      type="checkbox"
                  > {{ $t('auth.acceptStats') }}
                </label>
              </div>
            </div>
            <div
                v-if="config['requestData']"
                class="form-group row my-2"
            >
              <div class="col-md-6 offset-md-4">
                <label>
                  <input
                      v-model="formData['acceptDataSharing']"
                      name="acceptDataSharing"
                      type="checkbox"
                  > {{ $t('auth.acceptDataSharing') }}
                </label>
              </div>
            </div>
            <div class="col-md-6 offset-md-4">
              <BasicButton
                class="btn btn-primary"
                type="submit"
                :disabled="!config['isRegistrationEnabled']"
                :title="$t('auth.register')"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
  <TermsModal ref="terms"/>
</template>

<script>
/**
 *  Registration component
 *
 *  This component provides a basic mask to enter user information
 *  and register a user on the server.
 *
 *  @Author: Dennis Zyska, Carly Gettinger, Linyin Huang
 */
import TermsModal from "./TermsModal.vue";
import LogoSvg from "@/basic/icon/LogoSvg.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AuthRegister",
  components: {TermsModal, LogoSvg, BasicButton},
  data() {
    return {
      formData: {
        firstName: "",
        lastName: "",
        userName: "",
        email: "",
        password: "",
        acceptTerms: false,
        acceptStats: false,
        acceptDataSharing: false,
      },
      validity: null
    }
  },
  computed: {
    config() {
      return {
        requestName: JSON.parse(window.config["app.register.requestName"]),
        requestStats: JSON.parse(window.config["app.register.requestStats"]),
        isTrackingAgreed: JSON.parse(window.config["app.register.acceptStats.default"]),
        requestData: JSON.parse(window.config["app.register.requestData"]),
        isDataShared: JSON.parse(window.config["app.register.acceptDataSharing.default"]),
        isRegistrationEnabled: JSON.parse(window.config["app.register.enabled"])
      };
    },
    validEmail() {
      const emailRegEx = new RegExp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
      return emailRegEx.test(this.formData.email);
    },
    validUsername() {
      const usernameRegEx = new RegExp("^[a-zA-Z0-9]+$");
      return usernameRegEx.test(this.formData.userName);
    },
    validPassword() {
      const p = this.formData.password || "";
      return p.length >= 8
        && !/^\s*$/.test(p)
        && ![...p].some((c) => {
          const codePoint = c.codePointAt(0) || 0;
          return codePoint <= 31 || codePoint === 127;
        })
        && ![...p].some((c) => (c.codePointAt(0) || 0) > 0xFFFF);
    },
    validTerms() {
      return this.formData.acceptTerms;
    },
    validForm() {
      return this.validEmail && this.validUsername && this.validPassword && this.validTerms;
    }
  },
  mounted() {
    // Check if registration is enabled, if not redirect to login
    if (!this.config.isRegistrationEnabled) {
      this.$router.push({name: "login", query: {redirectedFrom: this.$route.query.redirectedFrom}});
      return;
    }
    // Sets initial values for acceptStats and acceptDataSharing
    if (this.config.requestStats) {
      this.formData.acceptStats = this.config.isTrackingAgreed;
    }
    if (this.config.requestData) {
      this.formData.acceptDataSharing = this.config.isDataShared;
    }
  },
  beforeMount() {
    this.validity = Object.fromEntries(Object.keys(this.formData).map(key => [key, false]));
  },
  methods: {
    checkVal(key) {
      this.validity[key] = true;
    },
    async checkForm() {
      if (!this.config.isRegistrationEnabled) {
        return;
      }
      Object.keys(this.validity).map(key => {
        this.validity[key] = true
      })
      if (this.validForm) {
        await this.registerUser();
      }
    },
    toLogin() {
      this.$router.push({name: "login", query: {redirectedFrom: this.$route.query.redirectedFrom}});
    },
    async registerUser() {
      try {
        await axios.post(getServerURL() + '/auth/register', {...this.formData, acceptedAt: new Date()}, {
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          }
        });
        if( window.config["app.register.emailVerification"] === "true" ) {
          this.eventBus.emit('toast', {
            message: this.$t('auth.messages.validationLinkSent'),
            title: this.$t('auth.messages.validateEmail'),
            variant: 'warning'
          });
        } else{
          this.eventBus.emit('toast', {
            message: this.$t('auth.messages.registrationSuccess'),
            title: this.$t('common.success'),
            variant: 'success'
          });
        }


        this.toLogin();
      } catch (err) {
        this.eventBus.emit('toast', {
          message: resolveApiMessage(err.response?.data || { message: err.message }, 'errors.server.unexpectedError'),
          title: this.$t('errors.auth.invalidCredentials'),
          variant: 'danger'
        });
      }
    }
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

input:focus[type='password'] + .feedback-invalid {
  visibility: visible;
}

input:focus[type='password']:not(.custom-invalid) + .feedback-invalid {
  color: black;
}

</style>