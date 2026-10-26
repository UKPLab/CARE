<template>
  <AuthLayout :title="$t('auth.ldap.institutionalLogin')">
    <template #header-action>
      <BasicButton
        class="btn btn-link btn-sm"
        :title="$t('common.back')"
        @click="backToPasswordLogin"
      />
    </template>
    <form class="needs-validation" novalidate @submit.prevent="checkForm">
      <p v-if="showError" class="text-danger text-center">
        {{ errorMessage }}
      </p>

      <div class="row">
        <label
          class="col-md-4 col-form-label"
          for="ldapUsername"
        >
          {{ $t('auth.ldap.institutionalUsername') }}
        </label>
        <div class="col-md-6">
          <input
            id="ldapUsername"
            v-model="formData.username"
            autocomplete="username"
            autofocus
            class="form-control"
            :placeholder="$t('auth.ldap.institutionalUsernamePlaceholder')"
            required
            type="text"
            @blur="checkVal('username')"
          />
          <div
            class="feedback-invalid"
            :class="{ invalid: validity['username'] && !validUsername }"
          >
            {{ $t('errors.validation.auth.provideInstitutionalUsername') }}
          </div>
        </div>
      </div>
      <div class="row">
        <label
          class="col-md-4 col-form-label"
          for="ldapPassword"
        >
          {{ $t('auth.ldap.institutionalPassword') }}
        </label>
        <div class="col-md-6">
          <input
            id="ldapPassword"
            v-model="formData.password"
            autocomplete="current-password"
            class="form-control"
            :placeholder="$t('auth.ldap.institutionalPasswordPlaceholder')"
            required
            type="password"
            @blur="checkVal('password')"
          />
          <div
            class="feedback-invalid"
            :class="{ invalid: validity['password'] && !validPassword }"
          >
            {{ $t('errors.validation.auth.provideInstitutionalPassword') }}
          </div>
        </div>
      </div>
      <div class="my-4">
        <BasicButton
          class="btn btn-primary w-100"
          type="submit"
          :loading="isSubmitting"
          :text="isSubmitting ? $t('auth.signingIn') : $t('auth.ldap.loginWithLdap')"
        />
      </div>
      <div class="text-center text-muted small">
        <p class="mb-0">
          <LoadIcon icon-name="shield-lock" :size="14"/>
          {{ $t('auth.ldap.passwordNotStoredLine1') }} <br />
          {{ $t('auth.ldap.passwordNotStoredLine2') }}
        </p>
      </div>
    </form>
  </AuthLayout>
</template>

<script>
/** LoginLdap component
 *
 * @author: Linyin Huang
 */
import AuthLayout from "@/auth/AuthLayout.vue";
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AuthLoginLdap",
  components: { AuthLayout, BasicButton, LoadIcon },
  data() {
    return {
      showError: false,
      errorMessage: "",
      formData: {
        username: "",
        password: "",
      },
      validity: null,
      isSubmitting: false,
    };
  },
  computed: {
    validUsername() {
      return this.formData.username.trim() !== "";
    },
    validPassword() {
      return this.formData.password !== "";
    },
    validForm() {
      return this.validUsername && this.validPassword;
    },
  },
  beforeMount() {
    this.validity = Object.fromEntries(
      Object.keys(this.formData).map((key) => [key, false]),
    );
  },
  mounted() {
    if (window.config["system.auth.ldap.enabled"] !== "true") {
      this.$router.replace({
        name: "login",
        query: { redirectedFrom: this.$route.query.redirectedFrom },
      });
    }
  },
  methods: {
    checkVal(key) {
      this.validity[key] = true;
    },
    async checkForm() {
      Object.keys(this.validity).forEach((key) => {
        this.validity[key] = true;
      });
      if (this.validForm) {
        const result = await this.loginLdap();
        if(result) {
          // TODO: May need to figure out another way to fix old user data persisting issue.
          this.$router.go(0);
        }
      }
    },
    async loginLdap() {
      this.isSubmitting = true;
      this.showError = false;
      this.errorMessage = "";

      try {
        const redirectedFrom = this.$route.query.redirectedFrom || "/dashboard";

        const response = await axios.post(
          `${getServerURL()}/auth/login/ldap`,
          {
            username: this.formData.username,
            password: this.formData.password,
            redirectedFrom,
          },
          {
            params: {
              redirectedFrom,
            },
            validateStatus(status) {
              return status === 200 || status === 400 || status === 401;
            },
            withCredentials: true,
          },
        );

        if (response.status === 400 || response.status === 401) {
          this.showError = true;
          this.errorMessage = resolveApiMessage(
            response.data,
            "errors.auth.invalidInstitutionalCredentials",
          );
          return false;
        }

        if (response.status === 200) {
          if (response.data.requiresTwoFactor) {
            const { method, methods, selectionRequired } = response.data;

            if (selectionRequired) {
              await this.$router.push({
                name: "2fa-select",
                query: {
                  methods: Array.isArray(methods) ? methods.join(",") : "",
                  redirectedFrom,
                },
              });
              return true;
            }

            if (method === "email") {
              await this.$router.push({
                name: "2fa-verify-email",
                query: {
                  redirectedFrom,
                },
              });
              return true;
            }

            if (method === "totp") {
              await this.$router.push({
                name: "2fa-verify-totp",
                query: {
                  redirectedFrom,
                },
              });
              return true;
            }

            this.showError = true;
            this.errorMessage = this.$t("errors.auth.unsupported2FAMethod");
            return false;
          }

          await this.$router.push(redirectedFrom);
          return true;
        }

        return false;
      } catch (error) {
        this.showError = true;
        this.errorMessage = resolveApiMessage(
          error.response?.data,
          "errors.auth.ldapLoginFailed",
        );
        return false;
      } finally {
        this.isSubmitting = false;
      }
    },
    backToPasswordLogin() {
      this.$router.push({
        name: "login",
        query: { redirectedFrom: this.$route.query.redirectedFrom },
      });
    },
  },
};
</script>
