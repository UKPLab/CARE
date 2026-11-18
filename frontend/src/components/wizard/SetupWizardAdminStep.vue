<template>
  <div class="card">
    <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
      <span>Setup – Admin account</span>
    </div>
    <div class="card-body mx-4 my-4">
      <p class="text-muted mb-3">
        No administrator account exists. Enter credentials now; the account is created on Finish.
      </p>
      <p v-if="showError" class="text-danger text-center">{{ errorMessage }}</p>
      <form @submit.prevent="submitAdmin()">
        <div class="form-group row my-2">
          <label class="col-md-4 col-form-label text-md-right" for="setup-username">Username</label>
          <div class="col-md-6">
            <input
              id="setup-username"
              :value="formData.userName"
              autocomplete="username"
              class="form-control"
              placeholder="admin"
              type="text"
              @blur="validity['userName'] = true"
              @input="$emit('update-admin-field', 'userName', $event.target.value)"
            />
            <div class="feedback-invalid" :class="{invalid: validity['userName'] && !validUserName}">
              Please provide a user name.
            </div>
          </div>
        </div>
        <div class="form-group row my-2">
          <label class="col-md-4 col-form-label text-md-right" for="setup-email">Email</label>
          <div class="col-md-6">
            <input
              id="setup-email"
              :value="formData.email"
              autocomplete="email"
              class="form-control"
              placeholder="admin@example.com"
              type="email"
              @blur="validity['email'] = true"
              @input="$emit('update-admin-field', 'email', $event.target.value)"
            />
            <div class="feedback-invalid" :class="{invalid: validity['email'] && !validEmail}">
              Please provide a valid email.
            </div>
          </div>
        </div>
        <div class="form-group row my-2">
          <label class="col-md-4 col-form-label text-md-right" for="setup-password">Password</label>
          <div class="col-md-6">
            <input
              id="setup-password"
              :value="formData.password"
              autocomplete="new-password"
              class="form-control"
              placeholder="Min. 8 characters"
              type="password"
              @blur="validity['password'] = true"
              @input="$emit('update-admin-field', 'password', $event.target.value)"
            />
            <div class="feedback-invalid" :class="{invalid: validity['password'] && !validPassword}">
              Password must be at least 8 characters. Use letters, numbers, and standard punctuation; no spaces-only or emojis.
            </div>
          </div>
        </div>
        <div class="col-md-6 offset-md-4 my-4">
          <BasicButton class="btn btn-primary" title="Next" @click="submitAdmin()" />
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

/**
 * Renders the first-time setup wizard admin account step: username, email, password, and
 * validation text under each field when the value is invalid.
 */
export default {
  name: "SetupWizardAdminStep",
  components: { BasicButton },
  props: {
    formData: {
      type: Object,
      required: true,
    },
    showError: {
      type: Boolean,
      required: true,
    },
    errorMessage: {
      type: String,
      required: true,
    },
  },
  emits: ["submit-admin", "update-admin-field", "created", "error"],
  data() {return {validity: {userName: false, email: false, password: false}};},
  computed: {
    validUserName() {
      return typeof this.formData.userName === "string" && this.formData.userName.trim() !== "";
    },
    validEmail() {
      const e = this.formData.email;
      if (!e || typeof e !== "string") return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
    },
    validPassword() {
      const p = this.formData.password || "";
      return typeof p === "string"
        && p.length >= 8
        && !/^\s*$/.test(p)
        && ![...p].some((c) => (c.codePointAt(0) || 0) < 32 || (c.codePointAt(0) || 0) === 127)
        && ![...p].some((c) => (c.codePointAt(0) || 0) > 0xFFFF);
    },
    adminFormValid() {
      return this.validUserName && this.validEmail && this.validPassword;
    },
  },
  methods: {
    submitAdmin() {
      Object.keys(this.validity).forEach(k => { this.validity[k] = true; });
      if (!this.adminFormValid) return;
      this.$emit("submit-admin");
    },
    async createAccount() {
      this.$emit("error", "");
      try {
        const res = await axios.post(
          getServerURL() + "/auth/setup-admin",
          {
            userName: this.formData.userName.trim(),
            email: this.formData.email.trim(),
            password: this.formData.password,
          },
          {
            withCredentials: true,
            validateStatus: function (status) {
              return status === 200 || (status >= 400 && status < 500);
            },
          }
        );
        if (res.status === 200) {
          this.$emit("created");
          return true;
        } else {
          this.$emit("error", (res.data && res.data.message) || "Setup failed. Please try again.");
          return false;
        }
      } catch (err) {
        this.$emit("error", err.message || "Setup failed. Please try again.");
        return false;
      }
    },
  },
};
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

.step-card-header {
  font-size: 1.2rem;
  font-weight: 600;
}
</style>
