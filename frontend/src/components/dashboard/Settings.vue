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
          />
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
        <button
            class="btn btn-secondary me-2"
            type="button"
            :disabled="uploading"
            @click="$refs.settingsUploadModal.close()"
        >
          Close
        </button>
        <button
            class="btn btn-primary"
            type="button"
            :disabled="!uploadFile || uploading"
            @click="importSettings"
        >
          <span
              v-if="uploading"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
          ></span>
          Import
        </button>
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

export default {
  name: "DashboardSettings",
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
        if (keys.length) {
          sections.push({
            title: step.charAt(0).toUpperCase() + step.slice(1),
            subsections: [{ title: "", keys }],
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
        otherGroups[group].push(s.key);
      }
      for (const [title, keys] of Object.entries(otherGroups).sort((a, b) => a[0].localeCompare(b[0]))) {
        sections.push({
          title,
          subsections: [{ title: "", keys }],
        });
      }
      return sections;
    },
    hasUnsavedChanges() {
      if (!this.settings || this.originalSettingsSnapshot === null) return false;
      try {
        return JSON.stringify(this.settings) !== this.originalSettingsSnapshot;
      } catch (e) {
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
    setSettingsSnapshot() {
      if (!this.settings) {
        this.originalSettingsSnapshot = null;
        return;
      }
      this.originalSettingsSnapshot = JSON.stringify(this.settings);
    },
    save() {
      this.$socket.emit("settingSave", this.settings, (res) => {
        if (res.success) {
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
          this.settings.reduce(
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
          throw new Error("Invalid JSON: " + e.message);
        }

        if (typeof json !== "object" || json === null || Array.isArray(json)) {
          throw new Error("The JSON must be an object of key/value pairs.");
        }

        let updatedCount = 0;
        const flat = json;

        // Overwrite only existing keys
        this.settings = this.settings.map((setting) => {
          if (Object.prototype.hasOwnProperty.call(flat, setting.key)) {
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
