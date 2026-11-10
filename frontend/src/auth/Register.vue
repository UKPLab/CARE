<template>
  <AuthLayout :title="$t('auth.register')" aside>
    <template #above-card>
      <ScientistMascot :mood="mascotMood"/>
    </template>
    <template #header-action>
      <a
          class="btn btn-link btn-sm"
          href="#"
          @click.prevent="toLogin"
      >{{ $t('auth.login') }}</a>
    </template>

    <div class="register-progress">
      <ol class="register-progress-track">
        <li
            v-for="(step, index) in steps"
            :key="step.id"
            :class="{ 'is-done': index < currentStep, 'is-active': index === currentStep }"
            :aria-current="index === currentStep ? 'step' : null"
        >
          <span class="visually-hidden">{{ step.title }}</span>
        </li>
      </ol>
      <div class="register-progress-label">
        <span class="register-progress-title">{{ activeStep.title }}</span>
        <span>{{ $t('auth.registerSteps.stepOf', { current: currentStep + 1, total: steps.length }) }}</span>
      </div>
    </div>

    <form
        ref="registerForm"
        class="needs-validation"
        novalidate
        @submit.prevent="onSubmit"
    >
      <!-- All steps share one grid cell, so the card keeps the height of the tallest step -->
      <div ref="stepViewport" class="register-viewport">
          <div
              v-for="(step, index) in steps"
              :key="step.id"
              class="register-step"
              :class="{
                'is-active': index === currentStep,
                'is-before': index < currentStep,
                'is-after': index > currentStep,
              }"
              :inert="index !== currentStep"
          >
            <template v-if="step.id === 'profile'">
              <div v-if="config['requestName']" class="row">
                <label
                    class="col-md-4 col-form-label"
                    for="firstName"
                >{{ $t('auth.firstName') }}</label>
                <div class="col-md-6">
                  <input
                      id="firstName"
                      v-model="formData['firstName']"
                      autocomplete="given-name"
                      class="form-control"
                      name="firstName"
                      required
                      type="text"
                      @blur="checkVal('firstName')"
                  >
                  <div class="feedback-invalid" :class="{invalid: validity['firstName'] && !validFirstName}">
                    {{ $t('errors.validation.auth.provideFirstName') }}
                  </div>
                </div>
              </div>

              <div v-if="config['requestName']" class="row">
                <label
                    class="col-md-4 col-form-label"
                    for="lastName"
                >{{ $t('auth.lastName') }}</label>
                <div class="col-md-6">
                  <input
                      id="lastName"
                      v-model="formData['lastName']"
                      autocomplete="family-name"
                      class="form-control"
                      name="lastName"
                      required
                      type="text"
                      @blur="checkVal('lastName')"
                  >
                  <div class="feedback-invalid" :class="{invalid: validity['lastName'] && !validLastName}">
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
                      autocomplete="username"
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
            </template>

            <template v-else-if="step.id === 'credentials'">
              <div class="row">
                <label
                    class="col-md-4 col-form-label"
                    for="email"
                >{{ $t('auth.email') }}</label>
                <div class="col-md-6">
                  <input
                      id="email"
                      v-model="formData['email']"
                      autocomplete="email"
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
                  <div
                      class="password-field"
                      @focusin="passwordFocused = true"
                      @focusout="onPasswordFocusOut"
                  >
                    <input
                        id="password"
                        v-model="formData['password']"
                        autocomplete="new-password"
                        class="form-control"
                        name="password"
                        pattern=".{8,}"
                        required
                        :type="showPassword ? 'text' : 'password'"
                        @blur="checkVal('password')"
                    >
                    <!-- mousedown.prevent keeps the focus in the input while toggling -->
                    <button
                        class="password-toggle"
                        type="button"
                        :aria-label="showPassword ? $t('auth.hidePassword') : $t('auth.showPassword')"
                        :aria-pressed="showPassword"
                        :title="showPassword ? $t('auth.hidePassword') : $t('auth.showPassword')"
                        @mousedown.prevent
                        @click="showPassword = !showPassword"
                    >
                      <i class="bi" :class="showPassword ? 'bi-eye-slash' : 'bi-eye'" aria-hidden="true"></i>
                    </button>
                  </div>
                  <div class="feedback-invalid" :class="{invalid: validity['password'] && !validPassword}">
                    {{ $t('errors.validation.auth.passwordRequirements') }}
                  </div>
                </div>
              </div>

              <div class="form-check mt-2">
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
            </template>

            <div v-else class="d-grid gap-2 pt-1">
              <p class="mb-0">{{ $t('auth.registerImprove.intro') }}</p>
              <p class="register-optional-note mb-1">{{ $t('auth.registerImprove.optional') }}</p>
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
          </div>
      </div>

      <div class="register-actions mt-4">
        <BasicButton
            v-if="currentStep > 0"
            class="btn btn-outline-secondary"
            :title="$t('common.back')"
            :disabled="isSubmitting"
            @click="previousStep"
        />
        <BasicButton
            v-if="!isLastStep"
            class="btn btn-primary flex-grow-1"
            type="submit"
            :title="$t('common.next')"
        />
        <BasicButton
            v-else
            class="btn btn-primary flex-grow-1"
            type="submit"
            :disabled="!config['isRegistrationEnabled']"
            :loading="isSubmitting"
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
 *  This component provides a mask to enter user information and register a user
 *  on the server. The fields are split into steps (profile, login details with
 *  the terms, optional opt-ins); each step is validated before the next one is shown.
 *
 *  @Author: Dennis Zyska, Carly Gettinger, Linyin Huang
 */
import TermsModal from "./TermsModal.vue";
import AuthLayout from "@/auth/AuthLayout.vue";
import BasicButton from "@/basic/Button.vue";
import ScientistMascot from "@/auth/ScientistMascot.vue";
import { navigateWithAuthTransition } from "@/auth/authTransition";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

/** How long the mascot waves after the page opens */
const MASCOT_WAVE_MS = 3200;

export default {
  name: "AuthRegister",
  components: {AuthLayout, TermsModal, BasicButton, ScientistMascot},
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
      validity: null,
      currentStep: 0,
      isSubmitting: false,
      showPassword: false,
      passwordFocused: false,
      mascotWaving: true,
      mascotWaveTimer: null,
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
    steps() {
      const steps = [
        {
          id: "profile",
          title: this.$t("auth.registerSteps.profile"),
          fields: this.config.requestName ? ["firstName", "lastName", "userName"] : ["userName"],
          valid: this.validUsername && (!this.config.requestName || (this.validFirstName && this.validLastName)),
        },
        {
          id: "credentials",
          title: this.$t("auth.registerSteps.credentials"),
          fields: ["email", "password", "acceptTerms"],
          valid: this.validEmail && this.validPassword && this.validTerms,
        },
      ];
      // The optional opt-ins get their own step only if at least one of them is requested
      if (this.config.requestStats || this.config.requestData) {
        steps.push({
          id: "improve",
          title: this.$t("auth.registerSteps.improve"),
          fields: [],
          valid: true,
        });
      }
      return steps;
    },
    activeStep() {
      return this.steps[this.currentStep];
    },
    isLastStep() {
      return this.currentStep === this.steps.length - 1;
    },
    /**
     * Covers the eyes while the password is typed, peeks while it is shown and approves once
     * the terms are accepted. On the optional step it reads, and approves any opt-in.
     */
    mascotMood() {
      if (this.activeStep.id === "improve") {
        return this.formData.acceptStats || this.formData.acceptDataSharing ? "approve" : "read";
      }
      if (this.activeStep.id === "credentials") {
        if (this.showPassword) {
          return "peek";
        }
        if (this.passwordFocused) {
          return "cover";
        }
        if (this.formData.acceptTerms) {
          return "approve";
        }
      }
      return this.mascotWaving ? "wave" : "idle";
    },
    validFirstName() {
      return this.formData.firstName.trim() !== "";
    },
    validLastName() {
      return this.formData.lastName.trim() !== "";
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
      return this.steps.every((step) => step.valid);
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
    this.focusFirstField();
    this.mascotWaveTimer = setTimeout(() => {
      this.mascotWaving = false;
    }, MASCOT_WAVE_MS);
  },
  beforeUnmount() {
    clearTimeout(this.mascotWaveTimer);
  },
  beforeMount() {
    this.validity = Object.fromEntries(Object.keys(this.formData).map(key => [key, false]));
  },
  methods: {
    checkVal(key) {
      this.validity[key] = true;
    },
    /** Focus moving between the input and the eye button still counts as "in the password field" */
    onPasswordFocusOut(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.passwordFocused = false;
      }
    },
    onSubmit() {
      if (this.isLastStep) {
        this.checkForm();
      } else {
        this.nextStep();
      }
    },
    nextStep() {
      this.activeStep.fields.forEach((key) => this.checkVal(key));
      if (!this.activeStep.valid) {
        return;
      }
      this.goToStep(this.currentStep + 1);
    },
    previousStep() {
      if (this.currentStep === 0) {
        return;
      }
      this.goToStep(this.currentStep - 1);
    },
    async checkForm() {
      if (!this.config.isRegistrationEnabled || this.isSubmitting) {
        return;
      }
      Object.keys(this.validity).forEach(key => {
        this.validity[key] = true
      })
      if (!this.validForm) {
        // Show the first step that still has a problem
        const invalidIndex = this.steps.findIndex((step) => !step.valid);
        if (invalidIndex !== this.currentStep) {
          this.goToStep(invalidIndex);
        }
        return;
      }
      await this.registerUser();
    },
    async goToStep(index) {
      this.currentStep = index;
      // Wait until the step is no longer inert, otherwise it cannot take focus
      await this.$nextTick();
      this.focusFirstField();
    },
    focusFirstField() {
      const step = this.$refs.stepViewport?.children[this.currentStep];
      step?.querySelector("input")?.focus({ preventScroll: true });
    },
    toLogin() {
      navigateWithAuthTransition(this.$router, {name: "login", query: {redirectedFrom: this.$route.query.redirectedFrom}}, "back");
    },
    async registerUser() {
      this.isSubmitting = true;
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
      } finally {
        this.isSubmitting = false;
      }
    }
  }
}
</script>

<style scoped>
/* The password hint stays visible as a plain note until it turns into an error */
.password-field + .feedback-invalid:not(.invalid) {
  visibility: visible;
  color: var(--bs-secondary-color);
}

.password-field + .feedback-invalid:not(.invalid)::before {
  content: none;
}

.password-field {
  position: relative;
}

.password-field .form-control {
  padding-right: 2.5rem;
}

/* The global invalid-border rule needs the input next to the message; restore it here */
.password-field:has(+ .feedback-invalid.invalid) .form-control {
  border-color: var(--bs-form-invalid-border-color);
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: .35rem;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: var(--bs-border-radius-sm);
  background: transparent;
  color: var(--bs-secondary-color);
  transform: translateY(-50%);
  transition: color .15s ease, background-color .15s ease;
}

.password-toggle:hover,
.password-toggle:focus-visible {
  color: var(--bs-primary);
  background: rgba(var(--bs-primary-rgb), .08);
}

.register-progress {
  margin-bottom: .75rem;
}

.register-progress-track {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.register-progress-track li {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--bs-border-color);
  transition: background-color .3s ease;
}

.register-progress-track li.is-done,
.register-progress-track li.is-active {
  background: var(--bs-primary);
}

.register-progress-label {
  display: flex;
  justify-content: space-between;
  margin-top: .5rem;
  font-size: .8rem;
  color: var(--bs-secondary-color);
}

.register-progress-title {
  font-weight: 600;
  color: var(--bs-body-color);
}

/* Steps are stacked in the same grid cell: the viewport is as tall as the tallest
   step, so switching steps never changes the card height. */
.register-viewport {
  display: grid;
  overflow-x: clip;
  overflow-clip-margin: 4px; /* keep input focus rings visible */
}

.register-step {
  grid-area: 1 / 1;
  display: flow-root;
  transition:
    opacity .3s ease,
    transform .4s cubic-bezier(.22, 1, .36, 1),
    visibility 0s linear .4s;
}

.register-step.is-active {
  transition-delay: .08s, .08s, 0s;
}

.register-step:not(.is-active) {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

.register-step.is-before {
  transform: translateX(-32px);
}

.register-step.is-after {
  transform: translateX(32px);
}

.register-optional-note {
  font-size: .85rem;
  color: var(--bs-secondary-color);
}

.register-actions {
  display: flex;
  gap: .5rem;
}

@media (prefers-reduced-motion: reduce) {
  .register-progress-track li,
  .register-step {
    transition: none;
  }
}
</style>
