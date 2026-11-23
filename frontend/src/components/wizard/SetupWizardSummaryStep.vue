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
      <p v-if="showError || accountError" class="text-danger text-center">{{ errorMessage || accountError }}</p>
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
              <BasicEditor :model-value="resolvedSummaryValue(s.key)" :read-only="true" />
            </template>
            <template v-else>
              <strong>{{ settingLabel(s.key) }}:</strong> {{ resolvedSummaryValue(s.key) }}
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
        <BasicButton v-if="currentStep > 0" class="btn btn-outline-secondary" title="Previous" @click="$emit('previous')" />
        <BasicButton
          class="btn btn-primary"
          :class="{ 'ms-auto': currentStep === 0 }"
          :title="finishing ? 'Saving…' : 'Finish'"
          :disabled="finishing"
          @click="finish"
        />
      </div>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import BasicEditor from "@/basic/editor/Editor.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

/**
 * Renders the first-time setup wizard summary step: admin recap, grouped settings for review,
 * optional imported JSON (expandable), import/download actions, and previous or finish controls.
 */
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
    showFileSettings: {
      type: Boolean,
      required: true,
    },
    currentStep: {
      type: Number,
      required: true,
    },
    createAdmin: {type: Function, required: true},
    accountError: {type: String, default: ''},
  },
  emits: ["download-template", "open-import-modal", "toggle-show-file-settings", "previous", "finish-start", "error"],
  data() {return {finishing: false, showError: false, errorMessage: ''};},
  computed: {
    summaryFieldGroups() {
      const stepTitles = {
        general: "General",
        mail: "Mail",
        registration: "Registration",
        moodle: "Moodle",
      };
      const byStep = {};
      for (const s of this.wizardSettings || []) {
        const step = s.wizardStep || "general";
        if (!byStep[step]) byStep[step] = [];
        byStep[step].push(s);
      }
      const order = ["general", "mail", "registration", "moodle"];
      return order.filter((step) => byStep[step]?.length).map((step) => ({
        title: stepTitles[step],
        settings: byStep[step],
      }));
    },
  },
  methods: {
    async finish() {
      this.$emit("finish-start");
      this.$emit("error", "");
      this.showError = false;
      this.errorMessage = "";

      if (!this.hasAdmin) {
        const created = await this.createAdmin();
        if (!created) return;
      }

      const merged = { ...this.formSettings, ...(this.settingsFromFile || {}) };
      if (merged["system.mailService.enabled"] !== "true") {
        merged["app.register.emailVerification"] = "false";
      }
      const payload = Object.entries(merged).map(([key, v]) => ({
        key,
        value: v === null || v === undefined ? "" : (typeof v === "boolean" ? (v ? "true" : "false") : (typeof v === "object" ? JSON.stringify(v) : String(v))),
      }));
      this.finishing = true;
      this.showError = false;
      try {
        const res = await axios.post(
          getServerURL() + "/setup/complete",
          { settings: payload },
          {
            withCredentials: true,
            validateStatus: (status) => status === 200 || (status >= 400 && status < 500),
          }
        );
        if (res.status !== 200 || !res.data?.success) {
          this.finishing = false;
          this.showError = true;
          this.errorMessage = res.data?.message || "Failed to save settings.";
          this.$emit("error", this.errorMessage);
          return;
        }
        this.$router.push("/dashboard");
        this.$router.go(0);
      } catch (err) {
        this.finishing = false;
        this.showError = true;
        this.errorMessage = err?.response?.data?.message || err?.message || "Failed to complete setup.";
        this.$emit("error", this.errorMessage);
      }
    },
    settingLabel(key) {
      const s = (this.wizardSettings || []).find((x) => x.key === key);
      return s?.displayName || key;
    },
    resolvedSummaryValue(key) {
      if (this.settingsFromFile && Object.prototype.hasOwnProperty.call(this.settingsFromFile, key)) {
        return this.settingsFromFile[key];
      }
      return this.formSettings[key] != null ? this.formSettings[key] : "—";
    },
  },
};
</script>
