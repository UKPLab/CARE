<template>
  <div class="card">
    <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
      <span>{{ stepTitle }}</span>
      <div class="d-flex flex-wrap gap-2">
        <BasicButton
          class="btn btn-outline-secondary btn-sm"
          text="Download template"
          :disabled="!allSettingsLoaded"
          :tooltip="allSettingsLoaded ? 'Download JSON: full settings snapshot with current wizard values applied' : 'Available after settings load'"
          @click="$emit('download-template')"
        />
        <BasicButton
          class="btn btn-outline-secondary btn-sm"
          text="Import from previous instance"
          tooltip="Load settings from a JSON file exported from another CARE instance"
          @click="$emit('open-import-modal')"
        />
      </div>
    </div>
    <div class="card-body mx-4 my-4">
      <p v-if="showError" class="text-danger text-center">{{ errorMessage }}</p>

      <template v-if="stepType === 'general'">
        <template v-if="settingsFromFile && Object.keys(settingsFromFile).length > 0">
          <p class="text-success mb-2">
            Loaded {{ Object.keys(settingsFromFile).length }} setting(s) from file. Click Next to continue to the summary.
          </p>
          <button
            class="btn btn-link btn-sm p-0 text-secondary"
            type="button"
            @click="$emit('clear-import')"
          >
            Clear and configure manually instead
          </button>
        </template>
        <template v-else>
          <p class="text-muted mb-3">
            Configure copyright notice, consent requirements, guest access, and links shown on the landing page.
          </p>

          <div v-for="group in generalFieldGroups" :key="group.title" class="mb-4">
            <h6 v-if="group.title" class="step-group-heading text-muted border-bottom pb-1 mb-3">
              {{ group.title }}
            </h6>
            <div v-for="s in group.settings" :key="s.key" class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                :for="'set-' + s.key"
                @click="(s.type === 'boolean' || s.type === 'bool') && $event.preventDefault()"
              >
                {{ settingLabel(s.key) }}
              </label>
              <div class="col-md-6 d-flex flex-column">
                <template v-if="s.type === 'boolean' || s.type === 'bool'">
                  <div class="form-check form-switch">
                    <input
                      :id="'set-' + s.key"
                      :checked="formSettings[s.key] === 'true'"
                      class="form-check-input"
                      type="checkbox"
                      @change="formSettings[s.key] = $event.target.checked ? 'true' : 'false'"
                    />
                  </div>
                </template>
                <template v-else-if="s.key === 'app.register.terms'">
                  <div class="d-flex align-items-center flex-wrap gap-2">
                    <EditorModal
                      :model-value="formSettings[s.key]"
                      :title="'Edit ' + settingLabel(s.key)"
                      @update:model-value="formSettings[s.key] = $event"
                    />
                    <span class="small text-muted">Open the editor to change terms and conditions.</span>
                  </div>
                </template>
                <template v-else-if="s.type === 'edits'">
                  <textarea
                    :id="'set-' + s.key"
                    v-model="formSettings[s.key]"
                    class="form-control w-100"
                    rows="5"
                  />
                </template>
                <input
                  v-else-if="s.type === 'integer'"
                  :id="'set-' + s.key"
                  v-model.number="formSettings[s.key]"
                  class="form-control"
                  type="number"
                />
                <input
                  v-else
                  :id="'set-' + s.key"
                  v-model="formSettings[s.key]"
                  class="form-control"
                  type="text"
                />
                <div v-if="settingDescription(s.key) || s.description" class="small text-muted mt-1">
                  {{ settingDescription(s.key) || s.description }}
                </div>
              </div>
              <div v-if="s.requiredInWizard" class="col-md-6 offset-md-4">
                <div class="feedback-invalid" :class="{invalid: settingsTouched && !(formSettings[s.key] != null && String(formSettings[s.key]).trim() !== '')}">
                  This field is required.
                </div>
              </div>
            </div>
          </div>

          <div v-if="moodleSettingsFlat.length" class="mb-4 mt-4">
            <h6 class="step-group-heading text-muted border-bottom pb-1 mb-2">
              Moodle <span class="fw-normal small">(optional)</span>
            </h6>
            <p class="small text-muted mb-3">
              Configure Moodle if you use it for enrollments or submissions. You can change these later under Settings -> Moodle.
            </p>
            <div v-for="s in moodleSettingsFlat" :key="s.key" class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                :for="'set-' + s.key"
                @click="(s.type === 'boolean' || s.type === 'bool') && $event.preventDefault()"
              >
                {{ settingLabel(s.key) }}
              </label>
              <div class="col-md-6 d-flex flex-column">
                <template v-if="s.type === 'boolean' || s.type === 'bool'">
                  <div class="form-check form-switch">
                    <input
                      :id="'set-' + s.key"
                      :checked="formSettings[s.key] === 'true'"
                      class="form-check-input"
                      type="checkbox"
                      @change="formSettings[s.key] = $event.target.checked ? 'true' : 'false'"
                    />
                  </div>
                </template>
                <input
                  v-else-if="s.type === 'integer'"
                  :id="'set-' + s.key"
                  v-model.number="formSettings[s.key]"
                  class="form-control"
                  type="number"
                />
                <input
                  v-else
                  :id="'set-' + s.key"
                  v-model="formSettings[s.key]"
                  class="form-control"
                  type="text"
                />
                <div v-if="settingDescription(s.key) || s.description" class="small text-muted mt-1">
                  {{ settingDescription(s.key) || s.description }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <template v-else-if="stepType === 'mail'">
        <div class="form-check form-switch mb-3">
          <input
            id="mail-enabled"
            :checked="formSettings['system.mailService.enabled'] === 'true'"
            class="form-check-input"
            type="checkbox"
            @change="formSettings['system.mailService.enabled'] = $event.target.checked ? 'true' : 'false'"
          />
          <label class="form-check-label" for="mail-enabled" @click.prevent>
            Enable email service (required for password reset and email verification)
          </label>
        </div>

        <template v-if="mailEnabled">
          <div v-for="group in mailFieldGroups" :key="group.title" class="mb-4">
            <h6 v-if="group.title" class="step-group-heading text-muted border-bottom pb-1 mb-3">
              {{ group.title }}
            </h6>
            <div v-for="s in group.settings" :key="s.key" class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                :for="'set-' + s.key"
                @click="(s.type === 'boolean' || s.type === 'bool') && $event.preventDefault()"
              >
                {{ settingLabel(s.key) }}
              </label>
              <div class="col-md-6 d-flex flex-column">
                <template v-if="s.type === 'boolean' || s.type === 'bool'">
                  <div class="form-check form-switch">
                    <input
                      :id="'set-' + s.key"
                      :checked="formSettings[s.key] === 'true'"
                      class="form-check-input"
                      type="checkbox"
                      @change="$emit('mail-setting-change', s.key, $event.target.checked ? 'true' : 'false')"
                    />
                  </div>
                </template>
                <template v-else-if="s.type === 'edits'">
                  <textarea
                    :id="'set-' + s.key"
                    v-model="formSettings[s.key]"
                    class="form-control w-100"
                    rows="4"
                  />
                </template>
                <input
                  v-else
                  :id="'set-' + s.key"
                  v-model="formSettings[s.key]"
                  class="form-control"
                  type="text"
                />
                <div v-if="settingDescription(s.key) || s.description" class="small text-muted mt-1">
                  {{ settingDescription(s.key) || s.description }}
                </div>
              </div>
            </div>
          </div>

          <div class="border-top pt-3 mt-4">
            <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">Send test email</h6>
            <p class="small text-muted mb-2">
              Sends a short fixed message so you can verify delivery before finishing setup.
            </p>
            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="setup-test-mail-to">Recipient</label>
              <div class="col-md-6 d-flex flex-column flex-sm-row gap-2 align-items-sm-start">
                <input
                  id="setup-test-mail-to"
                  :value="testMailTo"
                  class="form-control"
                  type="email"
                  placeholder="you@example.com"
                  autocomplete="email"
                  @input="$emit('update-test-mail-to', $event.target.value)"
                />
                <BasicButton
                  class="btn btn-outline-primary flex-shrink-0"
                  :title="testMailSending ? 'Sending...' : 'Send test email'"
                  :disabled="testMailSending || !testMailTo.trim()"
                  @click="$emit('send-test-mail')"
                />
              </div>
            </div>
            <p v-if="testMailMessage" class="small mb-0" :class="testMailError ? 'text-danger' : 'text-success'">
              {{ testMailMessage }}
            </p>
          </div>
        </template>
      </template>

      <template v-else>
        <p class="text-muted mb-3">
          Configure which information and consents are requested from users during registration.
        </p>
        <div v-for="group in registrationFieldGroups" :key="group.title" class="mb-4">
          <h6 v-if="group.title" class="step-group-heading text-muted border-bottom pb-1 mb-3">
            {{ group.title }}
          </h6>
          <div v-for="s in group.settings" :key="s.key" class="form-group row my-2">
            <label
              class="col-md-4 col-form-label text-md-right"
              :for="'set-' + s.key"
              @click="(s.type === 'boolean' || s.type === 'bool') && $event.preventDefault()"
            >
              {{ settingLabel(s.key) }}
            </label>
            <div class="col-md-6 d-flex flex-column">
              <template v-if="s.type === 'boolean' || s.type === 'bool'">
                <div class="form-check form-switch">
                  <input
                    :id="'set-' + s.key"
                    :checked="formSettings[s.key] === 'true'"
                    class="form-check-input"
                    type="checkbox"
                    @change="formSettings[s.key] = $event.target.checked ? 'true' : 'false'"
                  />
                </div>
              </template>
              <template v-else-if="s.type === 'edits'">
                <textarea
                  :id="'set-' + s.key"
                  v-model="formSettings[s.key]"
                  class="form-control w-100"
                  rows="4"
                />
              </template>
              <input
                v-else
                :id="'set-' + s.key"
                v-model="formSettings[s.key]"
                class="form-control"
                type="text"
              />
              <div v-if="settingDescription(s.key) || s.description" class="small text-muted mt-1">
                {{ settingDescription(s.key) || s.description }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="mailEnabled" class="mb-4">
          <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">Email verification</h6>
          <div class="form-group row my-2">
            <label class="col-md-4 col-form-label text-md-right" for="email-verification-reg" @click.prevent>
              {{ settingLabel("app.register.emailVerification") }}
            </label>
            <div class="col-md-6 d-flex flex-column">
              <div class="form-check form-switch">
                <input
                  id="email-verification-reg"
                  :checked="formSettings['app.register.emailVerification'] === 'true'"
                  class="form-check-input"
                  type="checkbox"
                  @change="formSettings['app.register.emailVerification'] = $event.target.checked ? 'true' : 'false'"
                />
              </div>
              <div class="small text-muted mt-1">
                Require new users to verify their email address before accessing the application.
              </div>
            </div>
          </div>
        </div>
      </template>

      <div class="d-flex justify-content-between mt-4">
        <BasicButton
          v-if="stepType === 'general' ? currentStep > 0 : true"
          class="btn btn-secondary"
          title="Previous"
          @click="$emit('previous')"
        />
        <BasicButton
          class="btn btn-primary"
          :class="nextButtonClass"
          title="Next"
          @click="$emit('next')"
        />
      </div>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import EditorModal from "@/basic/editor/Modal.vue";

export default {
  name: "SetupWizardSettingsStep",
  components: { BasicButton, EditorModal },
  props: {
    stepType: {
      type: String,
      required: true,
    },
    currentStep: {
      type: Number,
      required: true,
    },
    allSettingsLoaded: {
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
    settingsFromFile: {
      type: Object,
      required: false,
      default: null,
    },
    generalFieldGroups: {
      type: Array,
      required: true,
    },
    moodleSettingsFlat: {
      type: Array,
      required: true,
    },
    mailFieldGroups: {
      type: Array,
      required: true,
    },
    registrationFieldGroups: {
      type: Array,
      required: true,
    },
    formSettings: {
      type: Object,
      required: true,
    },
    settingsTouched: {
      type: Boolean,
      required: true,
    },
    mailEnabled: {
      type: Boolean,
      required: true,
    },
    testMailTo: {
      type: String,
      required: true,
    },
    testMailSending: {
      type: Boolean,
      required: true,
    },
    testMailMessage: {
      type: String,
      required: true,
    },
    testMailError: {
      type: Boolean,
      required: true,
    },
    settingLabel: {
      type: Function,
      required: true,
    },
    settingDescription: {
      type: Function,
      required: true,
    },
  },
  emits: [
    "download-template",
    "open-import-modal",
    "clear-import",
    "mail-setting-change",
    "update-test-mail-to",
    "send-test-mail",
    "previous",
    "next",
  ],
  computed: {
    stepTitle() {
      if (this.stepType === "mail") return "Mail Configuration";
      if (this.stepType === "registration") return "User Registration";
      return "General Settings";
    },
    nextButtonClass() {
      if (this.stepType === "general") {
        return { "ms-auto": this.currentStep === 0 };
      }
      return "ms-auto";
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

.step-group-heading {
  font-size: 1.1rem;
  font-weight: 600;
}

.step-card-header {
  font-size: 1.2rem;
  font-weight: 600;
}
</style>
