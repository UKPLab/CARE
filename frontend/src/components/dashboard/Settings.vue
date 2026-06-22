<template>
  <div>
    <Card title="Settings">
      <template #headerElements>
        <div class="btn-group gap-2">

          <BasicButton
              class="btn-outline-secondary btn-sm"
              text="Change User Settings"
              title="Change User Settings"
              icon="sliders"
              :disabled="!settings || !settings.length"
              @click="$refs.changeUserSettingsModal.open()"
          />

          <BasicButton
              class="btn-outline-secondary btn-sm"
              text="Export JSON"
              title="Export JSON"
              icon="download"
              :disabled="!settings || !settings.length"
              @click="exportSettings"
          />

          <BasicButton
              class="btn-outline-secondary btn-sm"
              text="Import JSON"
              title="Import JSON"
              icon="upload"
              :disabled="!settings || !settings.length"
              @click="openUploadModal"
          />

          <BasicButton
              class="btn-outline-secondary btn-sm"
              text="Reload"
              title="Reload"
              icon="arrow-clockwise"
              @click="load"
          />

          <BasicButton
              class="btn-sm"
              :class="hasUnsavedChanges ? 'btn-warning' : 'btn-primary'"
              :text="hasUnsavedChanges ? 'Save Settings (Unsaved changes)' : 'Save Settings'"
              :title="hasUnsavedChanges ? 'Save Settings (Unsaved changes)' : 'Save Settings'"
              icon="upload"
              @click="save"
          />

        </div>
      </template>

      <template #body>
        <div
            class="alert alert-warning d-flex align-items-center mt-1"
            role="alert"
        >
          <LoadIcon class="me-2" icon-name="exclamation-triangle-fill"/>
          <div>
            Remember to click <strong>Save Settings</strong> after making changes.
          </div>
        </div>

        <Loading v-if="settings === null"/>

        <div v-else class="mt-3">
          <SettingsSection
              v-for="section in sectionLayout"
              :key="section.title"
              :title="section.title"
              :subsections="section.subsections"
              :settings="displaySettings"
          >
            <template v-if="section.title === 'Mail'" #footer>
              <div class="border-top pt-3 mt-2">
                <h6 class="step-group-heading text-muted border-bottom pb-1 mb-2">Send test email</h6>
                <p class="small text-muted mb-2">
                  Sends a short fixed message using the currently saved mail configuration.
                </p>
                <div class="form-group row my-2">
                  <label class="col-md-4 col-form-label text-md-right" for="settings-test-mail-to">Recipient</label>
                  <div class="col-md-6 d-flex flex-column flex-sm-row gap-2 align-items-sm-start">
                    <input
                        id="settings-test-mail-to"
                        v-model="mailTestTo"
                        class="form-control"
                        type="email"
                        placeholder="you@example.com"
                        autocomplete="email"
                    />
                    <BasicButton
                        class="btn btn-outline-primary flex-shrink-0"
                        :title="mailTestSending ? 'Sending...' : 'Send test email'"
                        :disabled="mailTestSending || !mailTestTo.trim()"
                        @click="sendMailTest"
                    />
                  </div>
                </div>
                <p v-if="mailTestMessage" class="small mb-0" :class="mailTestError ? 'text-danger' : 'text-success'">
                  {{ mailTestMessage }}
                </p>
              </div>
            </template>
          </SettingsSection>
        </div>
      </template>
    </Card>

    <ChangeUserSettingsModal
        ref="changeUserSettingsModal"
        :settings="settings"
    />

    <Modal
        ref="settingsUploadModal"
        name="settingsUpload"
    >
      <template #title>
        Import Settings
      </template>

      <template #body>
        <div class="modal-body">
          <p class="mb-2">
            Select a previous downloaded settings file. Only existing keys will be updated.
          </p>
          <input
              ref="settingsUploadInput"
              type="file"
              class="form-control"
              accept=".json"
              @change="onUploadFileChange"
          />
        </div>
      </template>

      <template #footer>
        <span class="btn-group">
          <BasicButton
              class="btn btn-secondary"
              title="Close"
              :disabled="uploading"
              @click="$refs.settingsUploadModal.close()"
          />
          <BasicButton
              class="btn btn-primary"
              :title="uploading ? 'Importing…' : 'Import'"
              :disabled="!uploadFile || uploading"
              @click="importSettings"
          />
        </span>
      </template>
    </Modal>
  </div>
</template>

<script>
/**
 * Dashboard Settings Component
 *
 * This component provides an interface for viewing and modifying application settings.
 *
 * @author: Dennis Zyska
 */
import Card from "@/basic/dashboard/card/Card.vue";
import Loading from "@/basic/Loading.vue";
import LoadIcon from "@/basic/Icon.vue";
import SettingsSection from "@/components/dashboard/settings/SettingsSection.vue";
import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import {downloadObjectsAs} from "@/assets/utils";
import {onBeforeRouteUpdate} from "vue-router";
import ChangeUserSettingsModal from "@/components/dashboard/settings/ChangeUserSettingsModal.vue";

/**
 * Order of subsections within each section (for display).
 */
const SUBSECTION_ORDER = {
  general: [
    "Copyright and consent",
    "Login options",
    "Study mode",
    "Landing page links",
    "ORCID login",
    "LDAP login",
    "SAML login",
    "Two-factor authentication",
    "Auth redirects",
  ],
  mail: ["Mail service", "Sendmail", "SMTP", "Base URL and verification", "Email templates"],
  registration: ["Enable registration", "Information requested at registration", "Consent options", "Terms and conditions", "Email verification rate limit"],
  moodle: ["Connection", "Course", "Show inputs"],
  annotations: ["Comments", "Download", "NLP in annotations", "Sidebar"],
  interface: ["Navigation and dashboard", "Branding", "Projects", "Statistics and tags"],
  "text editor": ["Document buttons", "Edit history", "Toolbar"],
  "ai & nlp": ["Modal NLP", "NLP service"],
  system: ["Token expiry"],
};

export default {
  name: "DashboardSettings",
  subscribeTable: ["template"],
  components: {
    Card,
    LoadIcon,
    Loading,
    SettingsSection,
    BasicButton,
    Modal,
    ChangeUserSettingsModal,
  },
  data() {
    return {
      settings: null,
      uploadFile: null,
      uploading: false,
      originalSettingsSnapshot: null,
      mailTestTo: "",
      mailTestSending: false,
      mailTestMessage: "",
      mailTestError: false,
    };
  },
  computed: {
    displaySettings() {
      if (!this.settings) return [];
      return this.settings.filter((s) => !s.key.startsWith("app.setup."));
    },
    sectionLayout() {
      if (!this.displaySettings.length) return [];
      const wizardSteps = ["general", "mail", "registration", "moodle"];
      const sections = [];
      for (const step of wizardSteps) {
        let keys = this.displaySettings
          .filter((s) => s.wizardStep === step && s.showInWizard)
          .sort((a, b) => (a.wizardOrder || 0) - (b.wizardOrder || 0))
          .map((s) => s.key);
        const otherInStep = this.displaySettings.filter(
          (s) => !s.showInWizard && (s.displayGroup || "").toLowerCase() === step
        );
        if (otherInStep.length) {
          keys = [...keys, ...otherInStep.map((s) => s.key)];
        }

        // Terms of Service should be visible in both "General" and "Registration".
        if (step === "registration" && this.displaySettings.some((s) => s.key === "app.register.terms")) {
          if (!keys.includes("app.register.terms")) keys.push("app.register.terms");
        }

        if (keys.length) {
          const settingsInSection = keys.map((k) => this.displaySettings.find((s) => s.key === k)).filter(Boolean);
          sections.push({
            title: step.charAt(0).toUpperCase() + step.slice(1),
            subsections: this.buildSubsections(step, settingsInSection),
          });
        }
      }
      const other = this.displaySettings.filter((s) => !s.showInWizard);
      const mergedSteps = new Set(wizardSteps);
      const otherGroups = {};
      for (const s of other) {
        const group = s.displayGroup || "Other";
        if (mergedSteps.has((group || "").toLowerCase())) continue;
        if (!otherGroups[group]) otherGroups[group] = [];
        otherGroups[group].push(s);
      }
      for (const [groupTitle, settingsInGroup] of Object.entries(otherGroups).sort((a, b) => a[0].localeCompare(b[0]))) {
        sections.push({
          title: groupTitle,
          subsections: this.buildSubsections(groupTitle.toLowerCase(), settingsInGroup),
        });
      }
      return sections;
    },
    hasUnsavedChanges() {
      if (!this.settings || this.originalSettingsSnapshot === null) return false;
      try {
        return JSON.stringify(this.settings) !== this.originalSettingsSnapshot;
      } catch (_error) {
        return true;
      }
    },
  },
  mounted() {
    this.settings = null;
    this.load(false);

    onBeforeRouteUpdate((to, from, next) => {
      if (this.hasUnsavedChanges) {
        const answer = window.confirm(
            "You have unsaved changes in your settings. Are you sure you want to leave without saving?"
        );
        if (!answer) {
          return next(false);
        }
      }
      return next();
    });
  },
  methods: {
    /**
     * Build subsections from settings grouped by displaySubsection.
     * @param {string} sectionKey - Section key (e.g. "general", "annotations")
     * @param {Array} settingsInSection - Setting objects in this section
     * @returns {Array<{title: string, keys: string[]}>}
     */
    buildSubsections(sectionKey, settingsInSection) {
      if (!settingsInSection.length) return [];
      const order = SUBSECTION_ORDER[sectionKey];
      const bySubsection = {};
      for (const s of settingsInSection) {
        const sub = s.displaySubsection || "";
        if (!bySubsection[sub]) bySubsection[sub] = [];
        bySubsection[sub].push(s.key);
      }
      const result = [];
      if (order) {
        for (const title of order) {
          if (bySubsection[title]?.length) {
            result.push({ title, keys: bySubsection[title] });
          }
        }
      }
      for (const [title, keys] of Object.entries(bySubsection)) {
        if (!order || !order.includes(title)) {
          result.push({ title: title || "", keys });
        }
      }
      return result.length ? result : [{ title: "", keys: settingsInSection.map((s) => s.key) }];
    },
    setSettingsSnapshot() {
      if (!this.settings) {
        this.originalSettingsSnapshot = null;
        return;
      }
      this.originalSettingsSnapshot = JSON.stringify(this.settings);
    },
    sendMailTest() {
      const to = (this.mailTestTo || "").trim();
      if (!to || !this.$socket) return;
      this.mailTestSending = true;
      this.mailTestMessage = "";
      this.mailTestError = false;
      this.$socket.emit("mailSendTest", { to }, (res) => {
        this.mailTestSending = false;
        if (res.success) {
          this.mailTestError = false;
          this.mailTestMessage = typeof res.data === "string" ? res.data : "Test email sent.";
        } else {
          this.mailTestError = true;
          this.mailTestMessage = res.message || "Failed to send test email.";
        }
      });
    },
    save() {
      this.$socket.emit("settingSave", this.settings, (res) => {
        if (res.success) {
          this.settings.forEach((s) => {
            this.$store.commit("settings/set", { key: s.key, value: s.value });
          });
          this.eventBus.emit("toast", {
            title: "Success",
            message: res.data,
            variant: "success",
          });
          this.setSettingsSnapshot();
        } else {
          this.eventBus.emit("toast", {
            title: "Error Saving Settings",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    load(showToast = true) {
      this.$socket.emit("settingGetData", null, (res) => {
        if (res.success) {
          if (showToast) {
            this.eventBus.emit("toast", {
                title: "Settings Loaded",
                message: "Settings have been successfully loaded.",
                variant: "success",
            });
          }
          this.settings = res.data.sort((a, b) => (a.key > b.key ? 1 : -1));
          this.setSettingsSnapshot();
        } else {
          this.eventBus.emit("toast", {
            title: "Error Loading Settings",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    exportSettings() {
      downloadObjectsAs(
          this.displaySettings.reduce(
              (acc, {key, value}) => ({...acc, [key]: value}),
              {}
          ),
          "settings",
          "json"
      );
    },
    openUploadModal() {
      // reset state for new import
      this.uploadFile = null;
      this.uploading = false;

      // clear the file input so old filename disappears
      if (this.$refs.settingsUploadInput) {
        this.$refs.settingsUploadInput.value = null;
      }

      if (this.$refs.settingsUploadModal) {
        this.$refs.settingsUploadModal.waiting = false;
        this.$refs.settingsUploadModal.open();
      }
    },
    onUploadFileChange(event) {
      const file = event.target.files && event.target.files[0];
      this.uploadFile = file || null;
    },
    async importSettings() {
      if (!this.uploadFile) {
        this.eventBus.emit("toast", {
          title: "No file selected",
          message: "Please select a JSON file to import.",
          variant: "warning",
        });
        return;
      }

      const fileName = this.uploadFile.name || "";
      if (!fileName.toLowerCase().endsWith(".json")) {
        this.eventBus.emit("toast", {
          title: "Invalid file type",
          message: "Only JSON files are allowed.",
          variant: "danger",
        });
        return;
      }

      this.uploading = true;
      if (this.$refs.settingsUploadModal) {
        this.$refs.settingsUploadModal.waiting = true;
      }

      try {
        const text = await this.uploadFile.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          throw new Error("Invalid JSON: " + e.message, { cause: e });
        }

        if (typeof json !== "object" || json === null || Array.isArray(json)) {
          throw new Error("The JSON must be an object of key/value pairs.");
        }

        let updatedCount = 0;
        const flat = json;
        const visibleKeys = new Set(this.displaySettings.map((setting) => setting.key));

        // Overwrite only existing keys
        this.settings = this.settings.map((setting) => {
          if (visibleKeys.has(setting.key) && Object.prototype.hasOwnProperty.call(flat, setting.key)) {
            setting.value = flat[setting.key];
            updatedCount++;
          }
          return setting;
        });

        this.eventBus.emit("toast", {
          title: "Settings imported",
          message: `Updated ${updatedCount} existing setting(s).`,
          variant: "success",
        });

        if (this.$refs.settingsUploadModal) {
          this.$refs.settingsUploadModal.close();
        }

        // NOTE: we intentionally do NOT call setSettingsSnapshot() here.
        // Importing marks the form as "dirty" until the user clicks Save.
      } catch (e) {
        this.eventBus.emit("toast", {
          title: "Failed to import settings",
          message: e.message,
          variant: "danger",
        });
      } finally {
        this.uploading = false;
        if (this.$refs.settingsUploadModal) {
          this.$refs.settingsUploadModal.waiting = false;
        }
      }
    },
  },
};
</script>
