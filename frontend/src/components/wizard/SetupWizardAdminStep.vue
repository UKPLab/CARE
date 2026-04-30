<template>
  <div class="card">
    <div class="card-header step-card-header">Setup – Admin account</div>
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
              v-model="formData.userName"
              autocomplete="username"
              class="form-control"
              placeholder="admin"
              type="text"
              @blur="$emit('check-val', 'userName')"
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
              v-model="formData.email"
              autocomplete="email"
              class="form-control"
              placeholder="admin@example.com"
              type="email"
              @blur="$emit('check-val', 'email')"
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
              v-model="formData.password"
              autocomplete="new-password"
              class="form-control"
              placeholder="Min. 8 characters"
              type="password"
              @blur="$emit('check-val', 'password')"
            />
            <div class="feedback-invalid" :class="{invalid: validity['password'] && !validPassword}">
              Please provide a password of at least 8 characters.
            </div>
          </div>
        </div>
        <div class="col-md-6 offset-md-4 my-4">
          <BasicButton class="btn btn-primary" title="Continue" @click="$emit('submit-admin')" />
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

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
  emits: ["check-val", "submit-admin"],
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
