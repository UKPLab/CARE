<template>
  <div class="card">
    <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
      <span>Mail Configuration</span>
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

      <div class="form-check form-switch mb-3">
        <input
          id="mail-enabled"
          :checked="formSettings['system.mailService.enabled'] === 'true'"
          class="form-check-input"
          type="checkbox"
          @change="$emit('update:value', 'system.mailService.enabled', $event.target.checked ? 'true' : 'false')"
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

      </template>
      <SetupWizardTestMail v-show="mailEnabled" :form-settings="formSettings" />

      <div class="d-flex justify-content-between mt-4">
        <BasicButton class="btn btn-secondary" title="Previous" @click="$emit('previous')" />
        <BasicButton class="btn btn-primary ms-auto" title="Next" @click="$emit('next')" />
      </div>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import SetupWizardTestMail from "./SetupWizardTestMail.vue";

/**
 * Renders the first-time setup wizard mail step: mail service master toggle, sendmail versus SMTP subsection
 * groups, and optional "features that use email" row.
 */
export default {
  name: "SetupWizardMailStep",
  components: { BasicButton, SetupWizardTestMail },
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
  emits: [
    "download-template",
    "open-import-modal",
    "update:value",
    "previous",
    "next",
  ],
  data() {
    return {
      subsectionOrder: ["Mail service", "Sendmail", "SMTP", "Base URL and verification"],
    };
  },
  computed: {
    mailEnabled() {
      return this.formSettings["system.mailService.enabled"] === "true";
    },
    mailFieldGroups() {
      const sendmailEnabled = this.formSettings["system.mailService.sendMail.enabled"] === "true";
      const smtpEnabled = this.formSettings["system.mailService.smtp.enabled"] === "true";
      const sendmailKey = "system.mailService.sendMail.enabled";
      const smtpKey = "system.mailService.smtp.enabled";

      const groups = this.fieldGroupsForStep("mail")
        .map((g) => ({
          ...g,
          settings: (g.settings || []).filter((s) => s.key !== "system.mailService.enabled"),
        }))
        .filter((g) => g.settings.length > 0);

      const filteredGroups = groups.filter((g) => {
        if (sendmailEnabled && g.title === "SMTP") return false;
        if (smtpEnabled && g.title === "Sendmail") return false;
        return true;
      });

      const normalizedGroups = filteredGroups
        .map((g) => {
          if (g.title === "Sendmail" && !sendmailEnabled) {
            return { ...g, settings: g.settings.filter((s) => s.key === sendmailKey) };
          }
          if (g.title === "SMTP" && !smtpEnabled) {
            return { ...g, settings: g.settings.filter((s) => s.key === smtpKey) };
          }
          return g;
        })
        .filter((g) => g.settings.length > 0);

      const forgotPassword = (this.wizardSettings || []).find((s) => s.key === "app.login.forgotPassword");
      if (forgotPassword && this.mailEnabled) {
        normalizedGroups.push({ title: "Features that use email", settings: [forgotPassword] });
      }
      return normalizedGroups;
    },
  },
  methods: {
    /**
     * Group wizard settings by displaySubsection for a given step.
     * @param {string} stepType  Wizard step key
     * @returns {Array<Object>} Each item has title and settings.
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
