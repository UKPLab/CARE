<template>
  <div class="card">
    <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
      <span>General Settings</span>
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

      <template v-if="settingsFromFile && Object.keys(settingsFromFile).length > 0">
        <p class="text-success mb-2">
          Loaded {{ Object.keys(settingsFromFile).length }} setting(s) from file. Click Next to continue to the summary.
        </p>
        <BasicButton
          class="btn btn-link btn-sm p-0 text-secondary"
          text="Clear and configure manually instead"
          @click="$emit('clear-import')"
        />
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
                    @change="$emit('update:value', s.key, $event.target.checked ? 'true' : 'false')"
                  />
                </div>
              </template>
              <template v-else-if="s.key === 'app.register.terms'">
                <div class="d-flex align-items-center flex-wrap gap-2">
                  <EditorModal
                    :model-value="formSettings[s.key]"
                    :title="'Edit ' + settingLabel(s.key)"
                    @update:model-value="$emit('update:value', s.key, $event)"
                  />
                  <span class="small text-muted">Open the editor to change terms and conditions.</span>
                </div>
              </template>
              <template v-else-if="s.type === 'edits'">
                <textarea
                  :id="'set-' + s.key"
                  :value="formSettings[s.key]"
                  class="form-control w-100"
                  rows="5"
                  @input="$emit('update:value', s.key, $event.target.value)"
                />
              </template>
              <input
                v-else-if="s.type === 'integer'"
                :id="'set-' + s.key"
                :value="formSettings[s.key]"
                class="form-control"
                type="number"
                @input="onIntegerInput(s.key, $event)"
              />
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
            <div v-if="s.requiredInWizard" class="col-md-6 offset-md-4">
              <div
                class="feedback-invalid"
                :class="{invalid: settingsTouched && !(formSettings[s.key] != null && String(formSettings[s.key]).trim() !== '')}"
              >
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
                    @change="$emit('update:value', s.key, $event.target.checked ? 'true' : 'false')"
                  />
                </div>
              </template>
              <input
                v-else-if="s.type === 'integer'"
                :id="'set-' + s.key"
                :value="formSettings[s.key]"
                class="form-control"
                type="number"
                @input="onIntegerInput(s.key, $event)"
              />
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
      </template>

      <div class="d-flex justify-content-between mt-4">
        <BasicButton
          v-if="currentStep > 0"
          class="btn btn-secondary"
          title="Previous"
          @click="$emit('previous')"
        />
        <BasicButton
          class="btn btn-primary"
          :class="{ 'ms-auto': currentStep === 0 }"
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

/**
 * Renders the first-time setup wizard general step: subsection-grouped general settings, and optional Moodle fields
 */
export default {
  name: "SetupWizardGeneralStep",
  components: { BasicButton, EditorModal },
  props: {
    wizardSettings: {
      type: Array,
      required: true,
    },
    formSettings: {
      type: Object,
      required: true,
    },
    settingsFromFile: {
      type: Object,
      required: false,
      default: null,
    },
    settingsTouched: {
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
    allSettingsLoaded: {
      type: Boolean,
      required: true,
    },
    currentStep: {
      type: Number,
      required: true,
    },
  },
  emits: ["download-template", "open-import-modal", "clear-import", "previous", "next", "update:value"],
  data() {
    return {
      subsectionOrder: [
        "Copyright and consent",
        "Terms and conditions",
        "Login options",
        "Landing page links",
        "Connection",
        "Course",
        "Show inputs",
      ],
    };
  },
  computed: {
    generalFieldGroups() {
      return this.fieldGroupsForStep("general");
    },
    moodleSettingsFlat() {
      const list = (this.wizardSettings || []).filter((s) => s.wizardStep === "moodle");
      return [...list].sort((a, b) => (a.wizardOrder || 0) - (b.wizardOrder || 0));
    },
  },
  methods: {
    /**
     * Group wizard settings by displaySubsection for a given step.
     * @param {string} stepType  - Wizard step key
     * @returns {Array<Object>}  - Each item has title and settings.
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
     * @param {string} key  - Setting key.
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
    /**
     * Forward number input updates as a numeric value when possible so `formSettings` matches prior
     * v-model.number behaviour.
     * @param {string} key   - Setting key.
     * @param {Event} event  - Native input event from the number control.
     */
    onIntegerInput(key, event) {
      const raw = event.target.value;
      const n = raw === "" ? "" : Number(raw);
      this.$emit("update:value", key, Number.isNaN(n) ? raw : n);
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
