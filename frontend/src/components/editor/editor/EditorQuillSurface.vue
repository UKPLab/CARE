<template>
  <div
    id="viewerContainer"
    class="col border mh-100 justify-content-center p-3"
    style="overflow-y: scroll; position: relative;"
  >
    <!-- Read-Only Toolbar Bar -->
    <div
      v-if="!toolbarVisible && readOnly"
      class="readonly-toolbar-bar"
    >
      <LoadIcon icon-name="lock-fill" :size="16" />
      <span class="readonly-toolbar-text">{{ $t('editor.readOnlyMode') }}</span>
    </div>
    <div
      :id="containerId"
      @paste="onPaste"
      @copy="onCopy"
    >
    </div>
  </div>
</template>

<script>
/**
 * Quill surface of the document editor
 *
 * Creates the Quill editor with the toolbar tools enabled in the settings, switches it between editing and
 * read-only, reports the user's text changes and logs copied and pasted text. The document itself is loaded
 * and saved by Editor.vue, which gets the editor through the ready event.
 *
 * @author Juliane Bechert, Dennis Zyska, Manu Sundar Raj Nandyal, Zheyu Zhang, Alexander Bürkle
 */
import "quill/dist/quill.snow.css";
import {Editor, getToolbarTools} from "@/components/editor/editorStore.js";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "EditorQuillSurface",
  components: {LoadIcon},
  inject: {
    documentId: {default: 0},
    studySessionId: {default: null},
    studyStepId: {default: null},
    currentStudyStep: {default: null},
  },
  props: {
    readOnly: {type: Boolean, default: false},
  },
  emits: ["ready", "text-change"],
  data() {
    return {editor: null};
  },
  computed: {
    containerId() {
      return `editor-container-${this.studyStepId}`;
    },
    toolbarVisible() {
      return this.$store.getters["settings/getValue"]("editor.toolbar.visibility") === "true" && !this.readOnly;
    },
    editorOptions() {
      return {
        modules: {
          toolbar: this.toolbarVisible ? {container: getToolbarTools(this.$store.getters["settings/getValue"])} : false
        },
        theme: "snow"
      };
    },
    statsContext() {
      return {
        ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep?.id} : {}),
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
      };
    },
  },
  watch: {
    readOnly(newReadOnly) {
      this.editor.getEditor().enable(!newReadOnly);
      const toolbar = this.editor.getEditor().getModule("toolbar");
      if (toolbar && toolbar.container) {
        toolbar.container.style = newReadOnly ? "display:none" : "display:block";
      }
    },
  },
  mounted() {
    const editorContainer = document.getElementById(this.containerId);
    if (!editorContainer) return;
    this.editor = new Editor(editorContainer, this.editorOptions);

    if (this.toolbarVisible) {
      document.querySelectorAll(`#${this.containerId} .ql-toolbar button`).forEach(button => {
        const format = button.className.match(/ql-(\w+)/);
        if (format) {
          button.setAttribute('title', format[1]);
        }
      });
    }

    this.editor.getEditor().enable(!this.readOnly);
    this.editor.getEditor().on('text-change', (delta, oldContents, source) => {
      this.$emit("text-change", delta, oldContents, source);
    });
    this.$emit("ready", this.editor);
  },
  methods: {
    onPaste(event) {
      const pastedText = (event.clipboardData || window.clipboardData).getData('text');
      if (this.$store.getters["auth/getUser"].acceptStats && pastedText) {
        this.$socket.emit("stats", {action: "textPasted", data: {...this.statsContext, pastedText}});
      }
    },
    onCopy(event) {
      const copiedText = (event.clipboardData || window.clipboardData).getData('text');
      if (this.$store.getters["auth/getUser"].acceptStats && copiedText) {
        this.$socket.emit("stats", {action: "textCopied", data: {...this.statsContext, from: "editor", copiedText}});
      }
    },
  },
};
</script>

<style scoped>
.readonly-toolbar-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--bs-tertiary-bg, #f3f3f3);
  border: 1px solid var(--bs-border-color, #ccc);
  border-radius: 4px;
  margin-bottom: 0px;
  color: var(--bs-secondary-color, #666);
  font-size: 14px;
}
.readonly-toolbar-text {
  font-weight: 500;
}
</style>
