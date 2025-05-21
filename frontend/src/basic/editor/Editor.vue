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
      type: String,
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
      if (editor && editor.root.innerHTML !== newVal) {
        editor.root.innerHTML = newVal;
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
      modules: {
        toolbar: toolbarConfig,
      },
      readOnly: this.readOnly,
    });

    const editor = this.editorWrapper.getEditor();
    editor.root.innerHTML = this.modelValue;
    editor.enable(!this.readOnly);

    editor.on("text-change", () => {
      this.$emit("update:modelValue", editor.root.innerHTML);
    });

    editor.on("selection-change", (range) => {
      if (!range) {
        this.$emit("blur");
      }
    });
  },
  beforeUnmount() {
    this.editorWrapper = null;
  },
};
</script>
