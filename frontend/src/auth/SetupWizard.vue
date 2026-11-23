<template>
  <div class="setup-wizard">
    <div class="col-md-10 mx-auto my-4">
      <div class="text-center mb-4">
        <IconAsset :height="160" name="logo" />
      </div>

      <SetupWizardProgress :display-steps="displaySteps" :current-step="currentStep" />

      <SetupWizardAdminStep
        v-show="displaySteps[currentStep]?.key === 'admin'"
        ref="adminStep"
        :form-data="formData"
        :show-error="showError"
        :error-message="errorMessage"
        @submit-admin="onAdminNext"
        @created="hasAdmin = true"
        @error="setWizardError"
        @update-admin-field="setAdminField"
      />

      <SetupWizardGeneralStep
        v-show="displaySteps[currentStep]?.key === 'general'"
        :wizard-settings="wizardSettings"
        :form-settings="formSettings"
        :settings-from-file="settingsFromFile"
        :settings-touched="settingsTouched"
        :show-error="showError"
        :error-message="errorMessage"
        :all-settings-loaded="allSettingsLoaded"
        :current-step="currentStep"
        @download-template="downloadImportTemplate"
        @open-import-modal="openImportModal"
        @clear-import="clearImport"
        @update:value="setWizardSettingValue"
        @previous="onPrevious"
        @next="onStepNext"
      />

      <SetupWizardMailStep
        v-show="displaySteps[currentStep]?.key === 'mail'"
        :wizard-settings="wizardSettings"
        :form-settings="formSettings"
        :show-error="showError"
        :error-message="errorMessage"
        :all-settings-loaded="allSettingsLoaded"
        @download-template="downloadImportTemplate"
        @open-import-modal="openImportModal"
        @update:value="setWizardSettingValue"
        @previous="onPrevious"
        @next="onStepNext"
      />

      <SetupWizardRegistrationStep
        v-show="displaySteps[currentStep]?.key === 'registration'"
        :wizard-settings="wizardSettings"
        :form-settings="formSettings"
        :show-error="showError"
        :error-message="errorMessage"
        :all-settings-loaded="allSettingsLoaded"
        @download-template="downloadImportTemplate"
        @open-import-modal="openImportModal"
        @update:value="setWizardSettingValue"
        @previous="onPrevious"
        @next="onStepNext"
      />

      <SetupWizardSummaryStep
        v-show="displaySteps[currentStep]?.key === 'summary'"
        :all-settings-loaded="allSettingsLoaded"
        :has-admin="hasAdmin"
        :create-admin="createAdmin"
        :account-error="showError ? errorMessage : ''"
        :form-data="formData"
        :wizard-settings="wizardSettings"
        :form-settings="formSettings"
        :settings-from-file="settingsFromFile"
        :show-file-settings="showFileSettings"
        :current-step="currentStep"
        @finish-start="settingsTouched = true"
        @error="setWizardError"
        @download-template="downloadImportTemplate"
        @open-import-modal="openImportModal"
        @toggle-show-file-settings="showFileSettings = !showFileSettings"
        @previous="onPrevious"
      />

      <SetupWizardImportModal ref="importModal" :all-settings-from-db="allSettingsFromDb" @imported="applyImportedSettings" />
    </div>
  </div>
</template>

<script>
import SetupWizardImportModal from '@/components/wizard/SetupWizardImportModal.vue';
import SetupWizardProgress from '@/components/wizard/SetupWizardProgress.vue';
/**
 * First-time setup wizard: Admin, General (optional Moodle + JSON import), Mail, Registration, Summary.
 * Loads /setup/config (steps, wizardStepTypes, and wizardSettings). On Finish uses POST /setup/complete.
 *
 * @author Mohammad Elwan
 */
import IconAsset from "@/basic/icon/IconAsset.vue";
import SetupWizardAdminStep from "@/components/wizard/SetupWizardAdminStep.vue";
import SetupWizardGeneralStep from "@/components/wizard/SetupWizardGeneralStep.vue";
import SetupWizardMailStep from "@/components/wizard/SetupWizardMailStep.vue";
import SetupWizardRegistrationStep from "@/components/wizard/SetupWizardRegistrationStep.vue";
import SetupWizardSummaryStep from "@/components/wizard/SetupWizardSummaryStep.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import {downloadObjectsAs} from "@/assets/utils";

export default {
  name: "SetupWizard",
  components: {
    IconAsset,
    SetupWizardImportModal,
    SetupWizardProgress,
    SetupWizardAdminStep,
    SetupWizardGeneralStep,
    SetupWizardMailStep,
    SetupWizardRegistrationStep,
    SetupWizardSummaryStep,
  },
  data() {
    return {
      currentStep: 0,
      steps: [],
      wizardStepTypes: [],
      wizardSettings: [],
      hasAdmin: false,
      formData: { userName: "admin", email: "", password: "" },
      formSettings: {},
      settingsFromFile: null,
      settingsTouched: false,
      showFileSettings: false,
      showError: false,
      errorMessage: "",
      allSettingsFromDb: null,
    };
  },
  computed: {
    allSettingsLoaded() {
      return Array.isArray(this.allSettingsFromDb);
    },

    displaySteps() {
      const stepKeys = ["admin", "general", "mail", "registration", "summary"];
      let filtered = this.steps.filter((s) => stepKeys.includes(s.key));
      if (this.hasAdmin) {
        filtered = filtered.filter((s) => s.key !== "admin");
      }
      if (this.settingsFromFile && Object.keys(this.settingsFromFile).length > 0) {
        filtered = filtered.filter((s) => !["mail", "registration"].includes(s.key));
      }
      return filtered;
    },

    currentStepKey() {
      return this.displaySteps[this.currentStep]?.key;
    },
    settingsStepValid() {
      if (this.settingsFromFile && Object.keys(this.settingsFromFile).length > 0) {
        const required = (this.wizardSettings || []).filter((s) => s.requiredInWizard);
        const missing = required.filter((s) => {
          const v = this.settingsFromFile[s.key];
          return v == null || String(v).trim() === "";
        });
        return missing.length === 0;
      }
      const stepKey = this.currentStepKey;
      const stepSettings = (this.wizardSettings || []).filter((s) => s.wizardStep === stepKey);
      const required = stepSettings.filter((s) => s.requiredInWizard);
      return required.every(
        (s) => this.formSettings[s.key] != null && String(this.formSettings[s.key]).trim() !== ""
      );
    },
  },
  async mounted() {
    const check = await axios.get(getServerURL() + "/auth/check", { withCredentials: true });
    this.hasAdmin = !!(check.data && check.data.user);

    if (check.data.user) {
      if (check.data.wizardCompleted) {
        await this.$router.push("/dashboard");
        return;
      }
      this.hasAdmin = true;
    }
    if (!check.data.user && check.data.needsSetup !== true) {
      await this.$router.push("/login");
      return;
    }

    const config = await axios.get(getServerURL() + "/setup/config", { withCredentials: true });
    if (config.data && config.data.steps) {
      this.steps = config.data.steps;
    }
    if (config.data && Array.isArray(config.data.wizardStepTypes)) {
      this.wizardStepTypes = config.data.wizardStepTypes;
    }
    if (config.data && config.data.wizardSettings) {
      this.wizardSettings = config.data.wizardSettings;
      this.formSettings = config.data.wizardSettings.reduce((acc, s) => {
        acc[s.key] = this.wizardValueToFormString(s.value);
        return acc;
      }, {});

      // Keep sendmail and smtp mutually exclusive; sendmail takes precedence.
      if (this.formSettings["system.mailService.sendMail.enabled"] === "true") {
        this.formSettings["system.mailService.smtp.enabled"] = "false";
      }
    }
    if (config.data && Array.isArray(config.data.allSettings)) {
      this.allSettingsFromDb = config.data.allSettings;
    }
  },
  methods: {
    openImportModal() {this.$refs.importModal.open();},
    async createAdmin() {return this.$refs.adminStep.createAccount();},
    setWizardError(message) {this.showError = !!message; this.errorMessage = message;},
    onAdminNext() {this.showError=false; this.errorMessage=''; this.currentStep++;},
    applyImportedSettings(settings) {
      this.settingsFromFile=settings; this.showError=false;
      const summary=this.displaySteps.findIndex(step=>step.key==='summary');
      this.currentStep=summary>=0 ? summary : Math.max(this.displaySteps.length-1,0);
    },
    wizardValueToFormString(v) {
      if (v === null || v === undefined) return "";
      if (typeof v === "boolean") return v ? "true" : "false";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    },
    /**
     * Handle setting change from General, Mail, or Registration. Turning sendmail or SMTP on
     * clears the other transport.
     * @param {string} key          - Setting key
     * @param {string|number} value - New value
     */
    setWizardSettingValue(key, value) {
      this.formSettings[key] = value;

      const sendmailKey = "system.mailService.sendMail.enabled";
      const smtpKey = "system.mailService.smtp.enabled";
      if (key === sendmailKey && value === "true") {
        this.formSettings[smtpKey] = "false";
      }
      if (key === smtpKey && value === "true") {
        this.formSettings[sendmailKey] = "false";
      }
    },
    setAdminField(field, value) {
      this.formData[field] = value;
    },

    onPrevious() {
      if (this.displaySteps[this.currentStep]?.key === "summary") {
        this.clearImport();
      }
      this.currentStep--;
    },
    onStepNext() {
      this.settingsTouched = true;
      if (!this.settingsStepValid) {
        if (this.settingsFromFile && Object.keys(this.settingsFromFile).length > 0 && this.currentStepKey === "general") {
          this.showError = true;
          const required = (this.wizardSettings || []).filter((s) => s.requiredInWizard);
          const missing = required.filter((s) => {
            const v = this.settingsFromFile[s.key];
            return v == null || String(v).trim() === "";
          });
          this.errorMessage =
            missing.length > 0
              ? "The file must include non-empty values for: " + missing.map((s) => s.key).join(", ")
              : "Please upload a JSON file with key-value pairs.";
        } else {
          this.showError = false;
        }
        return;
      }
      this.showError = false;
      this.currentStep++;
    },

    downloadImportTemplate() {
      const serialize = (v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      };
      const flat = {};
      for (const row of this.allSettingsFromDb || []) {
        if (!row || !row.key) continue;
        flat[row.key] = serialize(row.value);
      }
      for (const [k, v] of Object.entries(this.formSettings || {})) {
        flat[k] = serialize(v);
      }
      downloadObjectsAs(flat, "care-settings-template", "json");
    },

    clearImport() {
      this.settingsFromFile = null;
    },

  },
};
</script>

<style scoped>
.setup-wizard {
  min-height: 100vh;
  max-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
}

</style>
