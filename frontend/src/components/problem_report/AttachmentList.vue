<template>
  <ul
    class="list-unstyled d-flex flex-wrap gap-2 mb-0"
    :aria-label="label || null"
  >
    <li
      v-for="attachment in attachments"
      :key="attachment.key"
      class="attachment-item border rounded p-2 d-flex flex-column gap-1"
    >
      <AttachmentMedia
        v-if="attachment.url"
        :url="attachment.url"
        :mime-type="attachment.mimeType"
        :name="attachment.name"
      />
      <span
        class="small text-truncate"
        :title="attachment.name"
      >{{ attachment.name }}</span>
      <span class="small text-body-secondary">{{ formatBytes(attachment.size) }}</span>
      <slot
        name="actions"
        :attachment="attachment"
      />
    </li>
  </ul>
</template>

<script>
import AttachmentMedia from "@/components/problem_report/AttachmentMedia.vue";
import { formatBytes } from "@/assets/problemReport.js";

/**
 * Thumbnails with name and size for problem report attachments.
 * CARE has no basic media gallery component, so this small list is shared by
 * the report form, the preview and the admin view.
 *
 * @param {Array} attachments Attachments as {key, name, size, mimeType, url}; url may be null until loaded
 * @param {String} label Accessible name of the list
 * @slot actions Controls per attachment (scoped: attachment)
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "AttachmentList",
  components: { AttachmentMedia },
  props: {
    attachments: {
      type: Array,
      required: true,
    },
    label: {
      type: String,
      required: false,
      default: "",
    },
  },
  methods: {
    formatBytes,
  },
};
</script>

<style scoped>
.attachment-item {
  width: 10rem;
  max-width: 100%;
}
</style>
