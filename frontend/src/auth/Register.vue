<template>
  <AuthLayout :title="$t('auth.register')">
    <template #header-action>
      <a
          class="btn btn-link btn-sm"
          href="#"
          @click="toLogin"
      >{{ $t('auth.login') }}</a>
    </template>
    <form
        ref="registerForm"
        class="needs-validation"
        novalidate
        @submit.prevent="checkForm"
    >
      <div
          v-if="config['requestName']"
          class="row"
      >
        <label
            class="col-md-4 col-form-label"
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
          class="row"
      >
        <label
            class="col-md-4 col-form-label"
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

      <div class="row">
        <label
            class="col-md-4 col-form-label"
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

      <div class="row">
        <label
            class="col-md-4 col-form-label"
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


      <div class="row">
        <label
            class="col-md-4 col-form-label"
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


      <div class="d-grid gap-2 mt-3">
        <div class="form-check">
          <input
              id="acceptTerms"
              v-model="formData['acceptTerms']"
              class="form-check-input"
              name="acceptTerms"
              type="checkbox"
              @blur="checkVal('acceptTerms')"
          >
          <label class="form-check-label" for="acceptTerms">
            {{ $t('auth.acceptTermsPrefix') }} <a
              href="#"
              @click.prevent="$refs.terms.open()"
            >{{ $t('auth.termsOfService') }}</a>
          </label>
          <div class="feedback-invalid" :class="{invalid: validity['acceptTerms'] && !validTerms}">
            {{ $t('errors.validation.auth.acceptTermsRequired') }}
          </div>
        </div>
        <div v-if="config['requestStats']" class="form-check">
          <input
              id="acceptStats"
              v-model="formData['acceptStats']"
              class="form-check-input"
              name="acceptStats"
              type="checkbox"
          >
          <label class="form-check-label" for="acceptStats">{{ $t('auth.acceptStats') }}</label>
        </div>
        <div v-if="config['requestData']" class="form-check">
          <input
              id="acceptDataSharing"
              v-model="formData['acceptDataSharing']"
              class="form-check-input"
              name="acceptDataSharing"
              type="checkbox"
          >
          <label class="form-check-label" for="acceptDataSharing">{{ $t('auth.acceptDataSharing') }}</label>
        </div>
      </div>
      <div class="mt-4">
        <BasicButton
          class="btn btn-primary w-100"
          type="submit"
          :disabled="!config['isRegistrationEnabled']"
          :title="$t('auth.register')"
        />
      </div>
    </form>
  </AuthLayout>
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
import AuthLayout from "@/auth/AuthLayout.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AuthRegister",
  components: {AuthLayout, TermsModal, BasicButton},
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
input[type='password'] + .feedback-invalid:not(.invalid) {
  visibility: visible;
  color: var(--bs-secondary-color);
}

input[type='password'] + .feedback-invalid:not(.invalid)::before {
  content: none;
}
</style>
