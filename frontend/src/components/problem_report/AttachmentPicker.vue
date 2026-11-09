<template>
  <div>
    <FormFile
      :key="inputKey"
      :options="fileOptions"
      @file-change="addFile"
    />
    <p class="small text-body-secondary mt-1 mb-2">
      {{ fileOptions.help }}
      {{ settings.attachmentTypes.join(', ') }}
    </p>
    <ul
      class="list-unstyled text-danger small mb-0"
      aria-live="polite"
    >
      <li
        v-for="error in errors"
        :key="error"
      >
        {{ error }}
      </li>
    </ul>
    <AttachmentList
      v-if="modelValue.length > 0"
      class="mt-2"
      :label="$t('problemReport.form.selectedAttachments')"
      :attachments="listItems"
    >
      <template #actions="{ attachment }">
        <BasicButton
          class="btn btn-sm btn-outline-danger"
          icon="trash"
          :text="$t('problemReport.form.remove')"
          :title="$t('problemReport.form.removeAttachment', { name: attachment.name })"
          :aria-label="$t('problemReport.form.removeAttachment', { name: attachment.name })"
          @click="remove(attachment.key)"
        />
      </template>
    </AttachmentList>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import FormFile from "@/basic/form/File.vue";
import AttachmentList from "@/components/problem_report/AttachmentList.vue";

let nextKey = 0;

/**
 * Adds problem report attachments one file at a time through the basic file input,
 * with previews and removal.
 *
 * Checks type, size and count against the problem report settings for early
 * feedback; the backend checks the file content and the same settings again.
 *
 * @param {Array} modelValue Selected attachments as {key, file, url}
 * @param {Object} settings Parsed report settings (readReportSettings)
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "AttachmentPicker",
  components: { BasicButton, FormFile, AttachmentList },
  props: {
    modelValue: {
      type: Array,
      required: true,
    },
    settings: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      errors: [],
      // Remounting the file input clears its selection after each added file
      inputKey: 0,
    };
  },
  computed: {
    atLimit() {
      return this.settings.attachmentsMaxCount !== null && this.modelValue.length >= this.settings.attachmentsMaxCount;
    },
    fileOptions() {
      return {
        key: "problemReportAttachment",
        label: `${this.$t('problemReport.form.attachments')} ${this.$t('problemReport.form.optional')}`,
        help: this.$t('problemReport.form.attachmentsHint', {
          count: this.settings.attachmentsMaxCount,
          fileMb: this.settings.maxFileSizeMb,
          totalMb: this.settings.maxTotalSizeMb,
        }),
        accept: this.settings.attachmentTypes.join(","),
        class: "form-control",
        // FormFile disables the input when the key exists
        ...(this.atLimit ? { disabled: true } : {}),
      };
    },
    listItems() {
      return this.modelValue.map((attachment) => ({
        key: attachment.key,
        name: attachment.file.name,
        size: attachment.file.size,
        mimeType: attachment.file.type,
        url: attachment.url,
      }));
    },
  },
  methods: {
    /**
     * Validate one picked file against the settings and add it.
     * @param {File} file Picked file
     */
    addFile(file) {
      this.inputKey++;
      if (!file) {
        return;
      }
      const error = this.fileError(file);
      this.errors = error ? [`${file.name}: ${error}`] : [];
      if (!error) {
        this.$emit("update:modelValue", [...this.modelValue, { key: `attachment-${nextKey++}`, file, url: URL.createObjectURL(file) }]);
      }
    },
    /**
     * @param {File} file Picked file
     * @returns {string|null} Translated reason the file cannot be attached
     */
    fileError(file) {
      const settings = this.settings;
      const total = this.modelValue.reduce((sum, attachment) => sum + attachment.file.size, 0) + file.size;
      if (!settings.attachmentTypes.includes((file.type || "").toLowerCase())) {
        return this.$t('errors.problemReport.unsupportedAttachmentType');
      }
      if (this.atLimit) {
        return this.$t('errors.problemReport.tooManyAttachments', { max: settings.attachmentsMaxCount });
      }
      if (file.size === 0) {
        return this.$t('errors.problemReport.invalidAttachment');
      }
      if (settings.attachmentsMaxFileBytes !== null && file.size > settings.attachmentsMaxFileBytes) {
        return this.$t('errors.problemReport.attachmentTooLarge', { maxMb: settings.maxFileSizeMb });
      }
      if (settings.attachmentsMaxTotalBytes !== null && total > settings.attachmentsMaxTotalBytes) {
        return this.$t('errors.problemReport.attachmentsTooLarge', { maxMb: settings.maxTotalSizeMb });
      }
      return null;
    },
    remove(key) {
      const attachment = this.modelValue.find((item) => item.key === key);
      if (attachment) {
        URL.revokeObjectURL(attachment.url);
      }
      this.errors = [];
      this.$emit("update:modelValue", this.modelValue.filter((item) => item.key !== key));
    },
    clearErrors() {
      this.errors = [];
    },
  },
};
</script>
