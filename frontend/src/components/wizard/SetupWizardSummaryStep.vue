<template>
  <div class="card">
    <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
      <span>Summary</span>
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
      <p class="text-muted mb-3">Review your choices before finishing.</p>

      <div v-if="!hasAdmin" class="mb-4">
        <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">Admin</h6>
        <ul class="list-unstyled mb-0">
          <li><strong>Username:</strong> {{ formData.userName || "—" }}</li>
          <li><strong>Email:</strong> {{ formData.email || "—" }}</li>
          <li><strong>Password:</strong> Password set</li>
        </ul>
      </div>

      <div v-for="group in summaryFieldGroups" :key="group.title" class="mb-4">
        <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">{{ group.title }}</h6>
        <ul class="list-unstyled ms-2 mb-0">
          <li v-for="s in group.settings" :key="s.key" class="mb-2">
            <template v-if="s.key === 'app.register.terms'">
              <div class="fw-semibold mb-1">{{ settingLabel(s.key) }}</div>
              <BasicEditor :model-value="summarySettingValue(s.key)" :read-only="true" />
            </template>
            <template v-else>
              <strong>{{ settingLabel(s.key) }}:</strong> {{ summarySettingValue(s.key) }}
            </template>
          </li>
        </ul>
      </div>

      <div v-if="settingsFromFile && Object.keys(settingsFromFile).length" class="mt-4">
        <BasicButton
          class="btn btn-link p-0 text-secondary"
          :title="`${showFileSettings ? '▼' : '▶'} Additional settings from file (${Object.keys(settingsFromFile).length})`"
          @click="$emit('toggle-show-file-settings')"
        />
        <ul v-show="showFileSettings" class="list-unstyled mt-2 ms-3 small">
          <li v-for="(v, k) in settingsFromFile" :key="k"><strong>{{ k }}:</strong> {{ v }}</li>
        </ul>
      </div>

      <div class="d-flex justify-content-between mt-4">
        <BasicButton v-if="currentStep > 0" class="btn btn-secondary" title="Previous" @click="$emit('previous')" />
        <BasicButton
          class="btn btn-primary"
          :class="{ 'ms-auto': currentStep === 0 }"
          :title="finishing ? 'Saving…' : 'Finish'"
          :disabled="finishing"
          @click="$emit('finish')"
        />
      </div>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import BasicEditor from "@/basic/editor/Editor.vue";

export default {
  name: "SetupWizardSummaryStep",
  components: { BasicButton, BasicEditor },
  props: {
    allSettingsLoaded: {
      type: Boolean,
      required: true,
    },
    hasAdmin: {
      type: Boolean,
      required: true,
    },
    formData: {
      type: Object,
      required: true,
    },
    summaryFieldGroups: {
      type: Array,
      required: true,
    },
    settingsFromFile: {
      type: Object,
      required: false,
      default: null,
    },
    showFileSettings: {
      type: Boolean,
      required: true,
    },
    currentStep: {
      type: Number,
      required: true,
    },
    finishing: {
      type: Boolean,
      required: true,
    },
    settingLabel: {
      type: Function,
      required: true,
    },
    summarySettingValue: {
      type: Function,
      required: true,
    },
  },
  emits: ["download-template", "open-import-modal", "toggle-show-file-settings", "previous", "finish"],
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
