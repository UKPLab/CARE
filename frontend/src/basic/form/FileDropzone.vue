<template>
  <label
    class="drag-drop-area"
    :class="{
      'is-dragover': dragover,
      'has-file': !!displayName,
      'is-disabled': disabled,
    }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="dragover = true"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <input
      ref="input"
      type="file"
      class="visually-hidden"
      :accept="accept"
      :disabled="disabled"
      @change="onInputChange"
    />
    <BasicIcon
      class="drag-drop-icon"
      :icon-name="displayName ? 'file-earmark' : 'cloud-arrow-up'"
      :size="40"
    />
    <span class="drag-drop-title">{{ displayName || titleText }}</span>
    <span
      v-if="hintText"
      class="drag-drop-hint"
    >{{ hintText }}</span>
  </label>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";

/**
 * Shared file picker: dashed drop target, click to browse, drag to add.
 * Used by form file fields and the import dialogs.
 */
export default {
  name: "FileDropzone",
  components: { BasicIcon },
  props: {
    accept: {
      type: String,
      required: false,
      default: "",
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    hint: {
      type: String,
      required: false,
      default: "",
    },
    fileName: {
      type: String,
      required: false,
      default: "",
    },
  },
  emits: ["change"],
  data() {
    return {
      dragover: false,
      dragCount: 0,
      pickedName: "",
    };
  },
  computed: {
    displayName() {
      return this.fileName || this.pickedName;
    },
    titleText() {
      return this.hint || this.$t("common.dropzone.title");
    },
    acceptLabel() {
      if (!this.accept) return "";
      const labels = this.accept.split(",").map((part) => {
        const rule = part.trim();
        if (!rule) return "";
        if (rule.startsWith(".")) return rule.slice(1).toUpperCase();
        return rule.split("/").pop().toUpperCase();
      }).filter(Boolean);
      return [...new Set(labels)].join(", ");
    },
    hintText() {
      if (this.displayName) return this.$t("common.dropzone.replace");
      return this.acceptLabel;
    },
  },
  methods: {
    clear() {
      this.pickedName = "";
      this.dragover = false;
      this.dragCount = 0;
      if (this.$refs.input) this.$refs.input.value = "";
    },
    onDragEnter() {
      this.dragCount += 1;
      this.dragover = true;
    },
    onDragLeave() {
      this.dragCount = Math.max(0, this.dragCount - 1);
      if (!this.dragCount) this.dragover = false;
    },
    onDrop(event) {
      this.dragCount = 0;
      this.dragover = false;
      const file = event.dataTransfer?.files?.[0] || null;
      if (file && !this.fileMatchesAccept(file)) return;
      this.applyFile(file);
    },
    onInputChange(event) {
      this.applyFile(event.target.files?.[0] || null);
    },
    fileMatchesAccept(file) {
      if (!this.accept) return true;
      const name = (file.name || "").toLowerCase();
      const type = (file.type || "").toLowerCase();
      return this.accept.split(",").some((part) => {
        const rule = part.trim().toLowerCase();
        if (!rule) return false;
        if (rule.startsWith(".")) return name.endsWith(rule);
        if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
        return type === rule;
      });
    },
    applyFile(file) {
      this.pickedName = file?.name || "";
      this.$emit("change", file);
    },
  },
};
</script>
