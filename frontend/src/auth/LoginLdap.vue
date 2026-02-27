<template>
  <form class="row g-3 needs-validation" novalidate @submit.prevent="checkForm">
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div class="text-center" style="margin-bottom: 20px">
          <IconAsset :height="200" name="logo" />
        </div>
        <div class="card">
          <div
            class="card-header d-flex justify-content-between align-items-center"
          >
            Institutional Login (LDAP)
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="backToPasswordLogin"
            >
              Back
            </button>
          </div>

          <div class="card-body mx-4 my-4">
            <p v-if="showError" class="text-danger text-center">
              {{ errorMessage }}
            </p>

            <div class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                for="ldapUsername"
              >
                Institutional Username
              </label>
              <div class="col-md-6">
                <input
                  id="ldapUsername"
                  v-model="formData.username"
                  autocomplete="username"
                  autofocus
                  class="form-control"
                  placeholder="Enter your institutional username"
                  required
                  type="text"
                  @blur="checkVal('username')"
                />
                <div
                  class="feedback-invalid"
                  :class="{ invalid: validity['username'] && !validUsername }"
                >
                  Please enter your institutional username.
                </div>
              </div>
            </div>
            <div class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                for="ldapPassword"
              >
                Institutional Password
              </label>
              <div class="col-md-6">
                <input
                  id="ldapPassword"
                  v-model="formData.password"
                  autocomplete="current-password"
                  class="form-control"
                  placeholder="Enter your institutional password"
                  required
                  type="password"
                  @blur="checkVal('password')"
                />
                <div
                  class="feedback-invalid"
                  :class="{ invalid: validity['password'] && !validPassword }"
                >
                  Please enter your institutional password.
                </div>
              </div>
            </div>
            <div class="col-md-6 offset-md-4 my-4">
              <button
                class="btn btn-primary btn-block"
                type="submit"
                :disabled="isSubmitting"
              >
                <span
                  v-if="isSubmitting"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                {{ isSubmitting ? "Signing in..." : "Login with LDAP" }}
              </button>
            </div>
            <div class="text-center text-muted small">
              <p class="mb-0">
                <i class="bi bi-shield-lock"></i>
                Your institutional password is not stored in CARE <br />
                and is only used for authentication against your institution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
</template>

<script>
/** LoginLdap component
 *
 * @author: Linyin Huang
 */
import IconAsset from "@/basic/icon/IconAsset.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "AuthLoginLdap",
  components: { IconAsset },
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
    if (window.config["system.auth.loginMethods.ldap.enabled"] !== "true") {
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
          this.errorMessage =
            response.data.message ||
            "Invalid institutional credentials. Please try again.";
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
            this.errorMessage = "Unsupported 2FA method returned from server.";
            return false;
          }

          await this.$router.push(redirectedFrom);
          return true;
        }

        return false;
      } catch (error) {
        this.showError = true;
        this.errorMessage =
          error.response?.data?.message ||
          "LDAP login failed. Please try again.";
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
</style>
