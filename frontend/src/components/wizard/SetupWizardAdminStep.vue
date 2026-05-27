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
      <form @submit.prevent="$emit('submit-admin')">
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
              @blur="$emit('check-val', 'userName')"
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
              @blur="$emit('check-val', 'email')"
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
              @blur="$emit('check-val', 'password')"
              @input="$emit('update-admin-field', 'password', $event.target.value)"
            />
            <div class="feedback-invalid" :class="{invalid: validity['password'] && !validPassword}">
              Password must be at least 8 characters. Use letters, numbers, and standard punctuation; no spaces-only or emojis.
            </div>
          </div>
        </div>
        <div class="col-md-6 offset-md-4 my-4">
          <BasicButton class="btn btn-primary" title="Next" @click="$emit('submit-admin')" />
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

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
    validity: {
      type: Object,
      required: true,
    },
    validUserName: {
      type: Boolean,
      required: true,
    },
    validEmail: {
      type: Boolean,
      required: true,
    },
    validPassword: {
      type: Boolean,
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
  emits: ["check-val", "submit-admin", "update-admin-field"],
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
