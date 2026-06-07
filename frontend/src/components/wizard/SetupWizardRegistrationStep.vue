<template>
  <div class="card">
    <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
      <span>User Registration</span>
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
                  @change="$emit('update:value', s.key, $event.target.checked ? 'true' : 'false')"
                />
              </div>
            </template>
            <template v-else-if="s.type === 'edits'">
              <textarea
                :id="'set-' + s.key"
                :value="formSettings[s.key]"
                class="form-control w-100"
                rows="4"
                @input="$emit('update:value', s.key, $event.target.value)"
              />
            </template>
            <input
              v-else
              :id="'set-' + s.key"
              :value="formSettings[s.key]"
              class="form-control"
              type="text"
              @input="$emit('update:value', s.key, $event.target.value)"
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
                @change="$emit('update:value', 'app.register.emailVerification', $event.target.checked ? 'true' : 'false')"
              />
            </div>
            <div class="small text-muted mt-1">
              Require new users to verify their email address before accessing the application.
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-between mt-4">
        <BasicButton class="btn btn-secondary" title="Previous" @click="$emit('previous')" />
        <BasicButton class="btn btn-primary ms-auto" title="Next" @click="$emit('next')" />
      </div>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

/**
 * Renders the first-time setup wizard registration step: subsection-grouped registration settings,
 * and email verification controls when mail is enabled.
 */
export default {
  name: "SetupWizardRegistrationStep",
  components: { BasicButton },
  props: {
    wizardSettings: {
      type: Array,
      required: true,
    },
    formSettings: {
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
    allSettingsLoaded: {
      type: Boolean,
      required: true,
    },
  },
  emits: ["download-template", "open-import-modal", "previous", "next", "update:value"],
  data() {
    return {
      subsectionOrder: [
        "Enable registration",
        "Information requested at registration",
        "Consent options",
        "Email verification rate limit",
      ],
    };
  },
  computed: {
    mailEnabled() {
      return this.formSettings["system.mailService.enabled"] === "true";
    },
    registrationFieldGroups() {
      return this.fieldGroupsForStep("registration")
        .map((g) => ({
          ...g,
          settings: (g.settings || []).filter((s) => s.key !== "app.register.terms"),
        }))
        .filter((g) => g.settings.length > 0);
    },
  },
  methods: {
    /**
     * Group wizard settings by displaySubsection for a given step.
     * @param {string} stepType  Wizard step key
     * @returns {Array<Object>}  Each item has title and settings.
     */
    fieldGroupsForStep(stepType) {
      const settings = (this.wizardSettings || []).filter((s) => s.wizardStep === stepType);
      if (!settings.length) return [];
      const order = this.subsectionOrder;
      const bySubsection = {};
      for (const s of settings) {
        const sub = s.displaySubsection || "";
        if (!bySubsection[sub]) bySubsection[sub] = [];
        bySubsection[sub].push(s);
      }
      const result = [];
      if (order) {
        for (const title of order) {
          if (bySubsection[title]?.length) {
            result.push({ title, settings: bySubsection[title] });
          }
        }
      }
      for (const [title, settingsList] of Object.entries(bySubsection)) {
        if (!order || !order.includes(title)) {
          result.push({ title: title || "", settings: settingsList });
        }
      }
      return result.length ? result : [{ title: "", settings }];
    },
    /**
     * Resolve the display label for a setting key using wizard metadata when available.
     * @param {string} key  Setting key.
     * @returns {string}
     */
    settingLabel(key) {
      const s = (this.wizardSettings || []).find((x) => x.key === key);
      return s?.displayName || key;
    },
    /**
     * Resolve the description for a setting key from wizard metadata, if defined.
     * @param {string} key  Setting key.
     * @returns {string|null}
     */
    settingDescription(key) {
      const s = (this.wizardSettings || []).find((x) => x.key === key);
      return s?.description || null;
    },
  },
};
</script>

<style scoped>
.step-group-heading {
  font-size: 1.1rem;
  font-weight: 600;
}

.step-card-header {
  font-size: 1.2rem;
  font-weight: 600;
}
</style>
