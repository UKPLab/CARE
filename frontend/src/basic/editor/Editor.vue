<template>
  <div>
    <div ref="quillContainer"></div>
  </div>
</template>

<script>
import { Editor } from "@/components/editor/editorStore"; 
import "quill/dist/quill.snow.css";

/**
 * Editor.vue - default component for rich text editing using Quill
 *
 * Use this component to show a text editor with basic markdown features.
 *
 * @author: Dennis Zyska, Juliane Bechert
 */
 export default {
  name: "BasicEditor",
  props: {
    modelValue: {
      type: [Object, String],
      required: true,
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue", "blur"],
  data() {
    return {
      editorWrapper: null,
    };
  },
  watch: {
    modelValue(newVal) {
      const editor = this.editorWrapper?.getEditor();
      if (!editor) return;

      let delta;
      try {
        delta = typeof newVal === "string" ? JSON.parse(newVal) : newVal;
      } catch (e) {
        console.warn("Failed to parse modelValue:", e);
        return;
      }

      const current = editor.getContents();
      if (JSON.stringify(current.ops) !== JSON.stringify(delta.ops)) {
        editor.setContents(delta);
      }
    },
  },
  mounted() {
    const toolbarConfig = this.readOnly
      ? false
      : [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "code-block"],
        ];

    this.editorWrapper = new Editor(this.$refs.quillContainer, {
      theme: "snow",
      modules: { toolbar: toolbarConfig },
      readOnly: this.readOnly,
    });

    const editor = this.editorWrapper.getEditor();

    try {
      const delta = typeof this.modelValue === "string"
        ? JSON.parse(this.modelValue)
        : this.modelValue;

      editor.setContents(delta);
    } catch (e) {
      console.error("Failed to load initial modelValue:", e);
    }

    editor.enable(!this.readOnly);

    editor.on("text-change", () => {
      const contents = editor.getContents();
      this.$emit("update:modelValue", contents); 
    });

    editor.on("selection-change", (range) => {
      if (!range) this.$emit("blur");
    });
  },
  beforeUnmount() {
    this.editorWrapper = null;
  },
};
</script>

<style scoped>
/* Add your styles here if needed */
</style>
