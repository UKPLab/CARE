<template>
  <template v-if="setting">
    <label
      class="col-md-4 col-form-label text-md-right"
      :for="'set-' + setting.key"
      @click="(setting.type === 'boolean' || setting.type === 'bool') && $event.preventDefault()"
    >
      <div class="d-inline-flex align-items-center gap-1 flex-wrap justify-content-md-end">
        <span>{{ setting.displayName || setting.key }}</span>
        <FormHelp
          v-if="setting.description"
          :help="translateMaybeKey(setting.description)"
          icon-name="info-circle"
          button-class="text-muted flex-shrink-0"
        />
      </div>
    </label>
    <div class="col-md-6 d-flex align-items-start">
      <template v-if="setting.type === 'edits'">
        <EditorModal
          :model-value="setting.value"
          :title="'Edit ' + setting.key"
          @update:model-value="$emit('update:value', $event)"
        />
      </template>
      <template v-else-if="setting.type === 'boolean' || setting.type === 'bool'">
        <div class="form-check form-switch">
          <input
            :id="'set-' + setting.key"
            :checked="setting.value === 'true'"
            class="form-check-input"
            type="checkbox"
            @change="$emit('update:value', $event.target.checked ? 'true' : 'false')"
          />
        </div>
      </template>
      <template v-else-if="setting.type === 'text'">
        <textarea
          :id="'set-' + setting.key"
          :value="setting.value"
          class="form-control w-100"
          rows="6"
          @input="$emit('update:value', $event.target.value)"
        ></textarea>
      </template>
      <template v-else-if="setting.type === 'color'">
        <div class="d-flex align-items-center gap-3 flex-wrap w-100">
          <input
            :id="'set-' + setting.key"
            :value="setting.value"
            type="color"
            class="form-control form-control-color"
            title="Pick a color"
            @input="updateColorValue($event.target.value)"
          />
          <input
            :value="setting.value"
            type="text"
            class="form-control"
            style="max-width: 110px; font-family: monospace;"
            maxlength="7"
            @input="updateColorValue($event.target.value)"
          />
          <LogoSvg
            v-if="showsLogoPreview"
            :height="40"
            :re-bg-color="setting.value"
          />
          <button
            v-if="hasResetValue"
            class="btn btn-outline-secondary btn-sm"
            type="button"
            :disabled="(setting.value || '').toLowerCase() === resetValue.toLowerCase()"
            @click="$emit('update:value', resetValue)"
          >
            Reset
          </button>
        </div>
      </template>
      <template v-else-if="isEmailTemplateSetting">
        <select
          :id="'set-' + setting.key"
          :value="setting.value"
          class="form-select"
          @change="$emit('update:value', $event.target.value)"
        >
          <option value="">None (use default email)</option>
          <option
            v-for="template in filteredEmailTemplates"
            :key="template.id"
            :value="String(template.id)"
          >
            {{ template.name }} (ID: {{ template.id }})
          </option>
        </select>
      </template>
      <input
        v-else
        :id="'set-' + setting.key"
        :value="setting.value"
        class="form-control"
        type="text"
        @input="$emit('update:value', $event.target.value)"
      />
    </div>
  </template>
</template>

<script>
import EditorModal from "@/basic/editor/Modal.vue";
import FormHelp from "@/basic/form/Help.vue";
import LogoSvg, { DEFAULT_RE_BG } from "@/basic/icon/LogoSvg.vue";
import { translateMaybeKey } from "@/assets/utils";

/**
 * Renders one setting row: label (displayName, optional description tooltip) and input for setting.type.
 */
export default {
  name: "SettingItem",
  components: { EditorModal, FormHelp, LogoSvg },
  subscribeTable: ["template"],
  props: {
    setting: {
      type: Object,
      default: null,
    },
  },
  emits: ["update:value"],
  computed: {
    user() {
      return this.$store.getters["auth/getUser"];
    },
    emailTemplates() {
      // Show only the user's own templates (copies count, since copies have userId === currentUser).
      return this.$store.getters["table/template/getAll"]
        .filter(t => !t.deleted && [1, 2, 3, 6, 7].includes(t.type) && t.userId === this.user?.id)
        .map(t => ({ id: t.id, name: t.name, type: t.type }));
    },
    isEmailTemplateSetting() {
      const s = this.setting;
      return !!(s && s.key && s.key.startsWith("email.template.")
        && (s.type === "number" || s.type === "integer"));
    },
    requiredEmailTemplateType() {
      const key = this.setting?.key;
      if (!key) return null;
      if (["email.template.passwordReset", "email.template.verification",
           "email.template.registration", "email.template.twoFactorOtp",
           "email.template.passwordResetSuccess"].includes(key)) return 1;
      if (["email.template.sessionStart", "email.template.sessionFinish"].includes(key)) return 2;
      if (key === "email.template.assignment") return 3;
      if (key === "email.template.studyClosed") return 6;
      if (["email.template.submissionUpload", "email.template.submissionUploadConfirmation"].includes(key)) return 7;
      return null;
    },
    filteredEmailTemplates() {
      return this.requiredEmailTemplateType !== null
        ? this.emailTemplates.filter(t => t.type === this.requiredEmailTemplateType)
        : this.emailTemplates;
    },
    showsLogoPreview() {
      return this.setting?.key === "logo.reBgColor";
    },
    resetValue() {
      if (this.setting?.key === "logo.reBgColor") return DEFAULT_RE_BG;
      return null;
    },
    hasResetValue() {
      return this.resetValue !== null;
    },
  },
  methods: {
    translateMaybeKey,
    updateColorValue(value) {
      const normalized = value && value.startsWith("#") ? value : `#${value || ""}`;
      if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
        this.$emit("update:value", normalized);
      }
    },
  }
};
</script>
