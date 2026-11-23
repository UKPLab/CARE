<template>
  <div>
    <Card :title="$t('settings.title')">
      <template #headerElements>
        <div class="btn-group gap-2">

          <BasicButton
              class="btn-secondary btn-sm"
              :text="$t('settings.changeUserSettings')"
              :title="$t('settings.changeUserSettings')"
              icon="sliders"
              :disabled="!settings || !settings.length"
              @click="$refs.changeUserSettingsModal.open()"
          />

          <BasicButton
              class="btn-secondary btn-sm"
              :text="$t('settings.exportJson')"
              :title="$t('settings.exportJson')"
              icon="download"
              :disabled="!settings || !settings.length"
              @click="exportSettings"
          />

          <BasicButton
              class="btn-secondary btn-sm"
              :text="$t('settings.importJson')"
              :title="$t('settings.importJson')"
              icon="upload"
              :disabled="!settings || !settings.length"
              @click="$refs.settingsImportModal.open()"
          />

          <BasicButton
              class="btn-secondary btn-sm"
              :text="$t('common.reload')"
              :title="$t('common.reload')"
              icon="arrow-clockwise"
              @click="load"
          />

          <BasicButton
              class="btn-sm"
              :class="hasUnsavedChanges ? 'btn-warning' : 'btn-primary'"
              :text="hasUnsavedChanges ? $t('settings.saveSettingsUnsaved') : $t('settings.saveSettings')"
              :title="hasUnsavedChanges ? $t('settings.saveSettingsUnsaved') : $t('settings.saveSettings')"
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
            <i18n-t
              keypath="settings.rememberToSave"
              tag="span"
            >
              <template #save>
                <strong>{{ $t('settings.saveSettings') }}</strong>
              </template>
            </i18n-t>
          </div>
        </div>

        <Loading v-if="settings === null"/>

        <SettingsSectionList v-else :settings="displaySettings">
          <template #mail-footer>
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
        </SettingsSectionList>
      </template>
    </Card>

    <ChangeUserSettingsModal
        ref="changeUserSettingsModal"
        :settings="settings"
    />

    <SettingsImportModal
        ref="settingsImportModal"
        @import="applyImportedSettings"
    />
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
import SettingsSectionList from "@/components/dashboard/settings/SettingsSectionList.vue";
import SettingsImportModal from "@/components/dashboard/settings/SettingsImportModal.vue";
import BasicButton from "@/basic/Button.vue";
import {downloadObjectsAs, resolveApiMessage} from "@/assets/utils";
import {onBeforeRouteUpdate} from "vue-router";
import ChangeUserSettingsModal from "@/components/dashboard/settings/ChangeUserSettingsModal.vue";

export default {
  name: "DashboardSettings",
  subscribeTable: ["template"],
  components: {
    Card,
    LoadIcon,
    Loading,
    SettingsSectionList,
    SettingsImportModal,
    BasicButton,
    ChangeUserSettingsModal,
  },
  data() {
    return {
      settings: null,
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
        const answer = window.confirm(this.$t('settings.messages.unsavedChangesWarning'));
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
          this.eventBus.emit("toast", {
            title: this.$t('common.success'),
            message: resolveApiMessage({ message: res.data }, 'settings.messages.settingsSavedSuccessfully'),
            variant: "success",
          });
          this.load(false);
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('errors.settings.errorSaving'),
            message: resolveApiMessage(res),
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
                title: this.$t('settings.messages.settingsLoaded'),
                message: this.$t('settings.messages.settingsLoadedMessage'),
                variant: "success",
            });
          }
          this.settings = res.data.sort((a, b) => (a.key > b.key ? 1 : -1));
          this.setSettingsSnapshot();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('errors.settings.errorLoading'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    /**
     * Overwrite the visible settings that occur in an imported JSON object. The form stays
     * "dirty" (no snapshot) until the user clicks Save.
     * @param {Object} imported - Flat map of setting key to value
     * @returns {void}
     */
    applyImportedSettings(imported) {
      let updatedCount = 0;
      const visibleKeys = new Set(this.displaySettings.map((setting) => setting.key));
      this.settings = this.settings.map((setting) => {
        if (visibleKeys.has(setting.key) && Object.prototype.hasOwnProperty.call(imported, setting.key)) {
          setting.value = imported[setting.key];
          updatedCount++;
        }
        return setting;
      });
      this.eventBus.emit("toast", {
        title: this.$t('settings.messages.settingsImported'),
        message: this.$t('settings.messages.updatedSettings', { count: updatedCount }),
        variant: "success",
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
  },
};
</script>
