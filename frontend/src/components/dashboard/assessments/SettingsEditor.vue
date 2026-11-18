<template>
  <FormCollapsible
    :title="$t('assessmentManagement.settings.title')"
    :description="$t('assessmentManagement.settings.description')"
    :collapsed="collapsed"
  >
    <p
      v-if="modelValue.length === 0"
      class="text-muted small fst-italic mb-2"
    >
      {{ readonly ? $t("assessmentManagement.settings.empty") : $t("assessmentManagement.settings.emptyEditable") }}
    </p>
    <div
      v-for="(row, index) in modelValue"
      :key="row.uid"
      class="mb-2 settings-row"
    >
      <div class="d-flex gap-2 align-items-start">
        <div class="flex-grow-1">
          <input
            :id="`settings-key-${row.uid}`"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': shown(row.uid, 'key') }"
            :value="row.key"
            :placeholder="$t('assessmentManagement.settings.key')"
            :aria-label="$t('assessmentManagement.settings.key')"
            :disabled="readonly"
            @input="update(row.uid, { key: $event.target.value })"
            @blur="touch(row.uid)"
          />
        </div>
        <div class="flex-grow-1">
          <input
            :id="`settings-value-${row.uid}`"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': shown(row.uid, 'value') }"
            :value="row.value"
            :placeholder="$t('assessmentManagement.settings.value')"
            :aria-label="$t('assessmentManagement.settings.value')"
            :disabled="readonly"
            @input="update(row.uid, { value: $event.target.value, raw: undefined })"
            @blur="touch(row.uid)"
          />
        </div>
        <BasicButton
          v-if="!readonly"
          class="btn btn-outline-danger"
          icon="trash"
          :title="$t('assessmentManagement.settings.remove')"
          @click="remove(index)"
        />
      </div>
      <div
        v-for="field in ['key', 'value']"
        :key="field"
      >
        <div
          v-if="shown(row.uid, field)"
          class="invalid-feedback d-block"
        >
          {{ $t(`assessmentManagement.errors.${errors.rows[row.uid][field]}`, { max: limits.maxEntries }) }}
        </div>
      </div>
    </div>
    <div
      v-if="errors.general"
      class="invalid-feedback d-block mb-2"
    >
      {{ $t(`assessmentManagement.errors.${errors.general}`, { max: limits.maxEntries }) }}
    </div>
    <BasicButton
      v-if="!readonly"
      class="btn btn-outline-secondary btn-sm"
      icon="plus-lg"
      :text="$t('assessmentManagement.settings.add')"
      :disabled="modelValue.length >= limits.maxEntries"
      @click="add"
    />
  </FormCollapsible>
</template>

<script>
/**
 * Advanced Settings of a criterion or rubric: free key/value rows in a collapsible section. No key is special.
 * Rows can be added and removed; keys are checked inline (empty, duplicate, too long, unsafe) and values for
 * their length. The rows live in the form of the parent, so they survive switching between the steps. With
 * `readonly` (a stored version) the rows are only displayed. The section starts open when it has rows or errors.
 *
 * The rows are turned into the settings object by settingsForm.js (typed values are sent as strings, an
 * untouched stored value keeps its type).
 *
 * @author Eyad Mohamed
 */
import BasicButton from "@/basic/Button.vue";
import FormCollapsible from "@/basic/form/Collapsible.vue";
import {
  SETTINGS_LIMITS,
  emptySettingsRow,
  validateSettingsRows,
} from "@/components/dashboard/assessments/settingsForm.js";

export default {
  name: "SettingsEditor",
  components: { BasicButton, FormCollapsible },
  props: {
    /** Rows `{uid, key, value, raw}` */
    modelValue: { type: Array, required: true },
    readonly: { type: Boolean, default: false },
    /** Show every error now, not only those of rows the user has left (set after a submit attempt) */
    showAll: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  data() {
    return { touched: {}, collapsed: this.modelValue.length === 0 };
  },
  computed: {
    limits() {
      return SETTINGS_LIMITS;
    },
    errors() {
      return this.readonly ? { rows: {} } : validateSettingsRows(this.modelValue);
    },
    hasErrors() {
      return Object.keys(this.errors.rows).length > 0 || Boolean(this.errors.general);
    },
  },
  watch: {
    showAll(value) {
      if (value && this.hasErrors) {
        this.collapsed = false;
      }
    },
  },
  methods: {
    /** A problem shows once the user has left the row (or after a submit attempt); not while typing the first time. */
    shown(uid, field) {
      return Boolean(this.errors.rows[uid]?.[field]) && (this.showAll || this.touched[uid] || field !== "key" || this.errors.rows[uid][field] !== "settingsKeyRequired");
    },
    touch(uid) {
      this.touched = { ...this.touched, [uid]: true };
    },
    update(uid, changes) {
      this.$emit("update:modelValue", this.modelValue.map((row) => (row.uid === uid ? { ...row, ...changes } : row)));
    },
    add() {
      this.collapsed = false;
      this.$emit("update:modelValue", [...this.modelValue, emptySettingsRow()]);
    },
    remove(index) {
      this.$emit("update:modelValue", this.modelValue.filter((_, i) => i !== index));
    },
  },
};
</script>
