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
      required: true
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
    this.editorWrapper = new Editor(this.$refs.quillContainer, {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "code-block"],
        ],
      },
    });

    const editor = this.editorWrapper.getEditor();
    editor.root.innerHTML = this.modelValue;

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
