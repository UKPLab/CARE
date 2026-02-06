<template>
  <form class="row g-3 needs-validation" novalidate @submit.prevent="checkForm">
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div class="text-center" style="margin-bottom: 20px">
          <IconAsset :height="200" name="logo" />
        </div>
        <div class="card">
          <div class="card-header">Two-Factor Authentication</div>
          <div class="card-body mx-4 my-4">
            <div class="text-center mb-4">
              <p class="mb-2">
                <strong>Institutional Authentication (LDAP)</strong>
              </p>
              <p class="text-muted">
                Please enter your institutional credentials to complete login.
              </p>
            </div>
            <!-- Domain -->
            <div v-if="ldapDomain" class="alert alert-info mb-3">
              <i class="bi bi-building"></i>
              <strong>Institution:</strong> {{ ldapDomain }}
            </div>
            <!-- LDAP Username -->
            <div class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                for="ldapUsername"
                >Institutional Username</label
              >
              <div class="col-md-6">
                <input
                  id="ldapUsername"
                  v-model="formData.ldapUsername"
                  autocomplete="username"
                  autofocus
                  class="form-control"
                  placeholder="Enter your institutional username"
                  required
                  type="text"
                  @blur="checkVal('ldapUsername')"
                />
                <div
                  class="feedback-invalid"
                  :class="{
                    invalid: validity['ldapUsername'] && !validUsername,
                  }"
                >
                  Please enter your institutional username
                </div>
              </div>
            </div>
            <!-- LDAP Password -->
            <div class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                for="ldapPassword"
                >Institutional Password</label
              >
              <div class="col-md-6">
                <input
                  id="ldapPassword"
                  v-model="formData.ldapPassword"
                  autocomplete="current-password"
                  class="form-control"
                  placeholder="Enter your institutional password"
                  required
                  type="password"
                  @blur="checkVal('ldapPassword')"
                />
                <div
                  class="feedback-invalid"
                  :class="{
                    invalid: validity['ldapPassword'] && !validPassword,
                  }"
                >
                  Please enter your institutional password
                </div>
              </div>
            </div>
            <!-- Domain Input (if not preset) -->
            <div v-if="!ldapDomain" class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                for="ldapDomainInput"
                >Institutional Domain
                <span class="text-muted">(Optional)</span></label
              >
              <div class="col-md-6">
                <input
                  id="ldapDomainInput"
                  v-model="formData.ldapDomainInput"
                  class="form-control"
                  placeholder="e.g., university.edu"
                  type="text"
                />
                <div class="form-text">
                  Enter your institution's domain if applicable
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
                {{ isSubmitting ? "Verifying..." : "Verify" }}
              </button>
              <button
                class="btn btn-link"
                type="button"
                @click="cancelVerification"
              >
                Cancel
              </button>
            </div>
            <div class="text-center text-muted small">
              <p class="mb-0">
                <i class="bi bi-shield-check"></i>
                Your institutional password is not stored and is only used for
                real-time verification
              </p>
              <p class="mb-0">
                Authentication is performed through your institution's LDAP
                server
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
</template>

<script>
/**
 * TwoFactorVerifyLDAP Component
 *
 * LDAP institutional credential verification page during login flow
 *
 * @author: Linyin Huang
 */
import IconAsset from "@/basic/icon/IconAsset.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "TwoFactorVerifyLDAP",
  components: { IconAsset },
  data() {
    return {
      formData: {
        ldapUsername: "",
        ldapPassword: "",
        ldapDomainInput: "",
      },
      validity: null,
      isSubmitting: false,
      ldapDomain: "", // Preset domain from user settings
    };
  },
  computed: {
    validUsername() {
      return this.formData.ldapUsername.trim() !== "";
    },
    validPassword() {
      return this.formData.ldapPassword !== "";
    },
    validForm() {
      return this.validUsername && this.validPassword;
    },
  },
  beforeMount() {
    this.validity = Object.fromEntries(
      Object.keys(this.formData).map((key) => [key, false]),
    );

    // Get preset LDAP domain from route query params (if available)
    if (this.$route.query.ldapDomain) {
      this.ldapDomain = this.$route.query.ldapDomain;
    }
  },
  methods: {
    checkVal(key) {
      this.validity[key] = true;
    },
    async checkForm() {
      Object.keys(this.validity).map((key) => {
        this.validity[key] = true;
      });
      if (this.validForm) {
        await this.verifyLDAP();
      }
    },
    async verifyLDAP() {
      this.isSubmitting = true;
      try {
        const payload = {
          username: this.formData.ldapUsername.trim(),
          password: this.formData.ldapPassword,
        };

        // Add domain if available (either preset or user input)
        const domain = this.ldapDomain || this.formData.ldapDomainInput.trim();
        if (domain) {
          payload.domain = domain;
        }

        const response = await axios.post(
          getServerURL() + "/auth/2fa/ldap/verify",
          payload,
          {
            validateStatus: function (status) {
              return status === 200 || status === 400 || status === 401;
            },
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          setTimeout(() => {
            this.$router.push(this.$route.query.redirectedFrom || "/dashboard");
          }, 1000);
        } else {
          this.eventBus.emit("toast", {
            title: "Verification Error",
            message:
              response.data.message ||
              "Invalid institutional credentials. Please try again.",
            variant: "danger",
          });
        }
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Verification Error",
          message:
            error.response?.data?.message ||
            "Verification failed. Please check your credentials.",
          variant: "danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    cancelVerification() {
      // Return to login page
      this.$router.push({ name: "login" });
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
