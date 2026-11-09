<template>
  <video
    v-if="isVideo"
    class="attachment-media rounded"
    :src="url"
    :aria-label="name"
    controls
    muted
    preload="metadata"
  />
  <img
    v-else
    class="attachment-media rounded"
    :src="url"
    :alt="name"
  >
</template>

<script>
/**
 * Thumbnail preview of an image or video attachment from an object URL.
 *
 * @param {String} url Object URL of the file
 * @param {String} mimeType MIME type deciding between image and video
 * @param {String} name File name used as accessible name
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "AttachmentMedia",
  props: {
    url: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
  },
  computed: {
    isVideo() {
      return this.mimeType.startsWith("video/");
    },
  },
};
</script>

<style scoped>
.attachment-media {
  width: 100%;
  height: 6rem;
  object-fit: cover;
  background-color: var(--bs-tertiary-bg);
}
</style>
