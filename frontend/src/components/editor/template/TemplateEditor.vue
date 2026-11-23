<template>
    <Loader
      v-if="templateId === 0"
      :loading="true"
      class="pageLoader"
    />
    <span v-else>
      <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
        <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
          <div
            id="viewerContainer"
            ref="viewer"
            class="col border mh-100 justify-content-center p-3 template-viewer-column"
          >
            <div
              class="template-viewport"
              :class="{ 'template-viewport--preview': previewMode && templateSupportsPlaceholderPreview }"
            >
              <TemplateQuillSurface
                :template-id="templateId"
                :preview-mode="previewMode"
                @paste="onPaste"
                @copy="onCopy"
              />
            <TemplateExamplePreview
              v-show="previewMode && templateSupportsPlaceholderPreview"
              :html="previewDisplayHtml"
            />
            </div>
          </div>
        </div>
      </div>
      <TemplateLanguageChoiceModal
        ref="newLanguageModal"
        :message="newLanguageModalMessage"
        @hide="onNewLanguageModalHide"
        @empty="chooseNewLanguageEmpty"
        @copy="chooseNewLanguageCopied"
      />
    </span>
  </template>

  <script>
import TemplateQuillSurface from "./TemplateQuillSurface.vue";
import TemplateExamplePreview from "./TemplateExamplePreview.vue";
import TemplateLanguageChoiceModal from "./TemplateLanguageChoiceModal.vue";
  /**
   * Template Editor component
   *
   * Quill editor for editing template content per language.
   * Toolbar includes a language selector.
   * Switching language saves the current language and loads the selected one;
   * adding a new language shows a popup (Empty / Copied); X reverts to previous language.
   *
   * @author Mohammad Elwan
   */
  import "quill/dist/quill.snow.css";
  import debounce from "lodash.debounce";
  import {Editor} from "@/components/editor/editorStore.js";
  import Loader from "@/basic/Loading.vue";
  import { quillTemplateToolbarData, quillTemplateToolbarComputed, quillTemplateToolbarMethods } from "@/components/editor/template/helpers/quillTemplateToolbar.js";
  import { templateLanguageSwitchingData, templateLanguageSwitchingComputed, templateLanguageSwitchingMethods } from "@/components/editor/template/helpers/templateLanguageSwitching.js";
  import { templateContentSyncData, templateContentSyncComputed, templateContentSyncMethods } from "@/components/editor/template/helpers/templateContentSync.js";
  import { templatePlaceholderPreviewData, templatePlaceholderPreviewComputed, templatePlaceholderPreviewMethods } from "@/components/editor/template/helpers/templatePlaceholderPreview.js";

  export default {
    name: "TemplateEditor",
    components: {TemplateQuillSurface, TemplateExamplePreview, TemplateLanguageChoiceModal, Loader},
    inject: {
      currentStudyStep: {type: Object, required: false, default: null},
      studySessionId: {type: Number, required: false, default: null},
      studyStepId: {type: Number, required: false, default: null},
      documentId: {type: Number, required: false, default: null},
      templateId: {
        type: Number,
        required: true,
        default: 0,
      },
      readOnly: {
        type: Boolean,
        required: false,
        default: false,
      },
    },
    emits: ["update:data", "preview-mode-change"],
    data() {
      return {
        editor: null,
        templateLoaded: false,
        // quillTemplateToolbar.js
        ...quillTemplateToolbarData(),
        // templateLanguageSwitching.js
        ...templateLanguageSwitchingData(),
        // templateContentSync.js
        ...templateContentSyncData(),
        // templatePlaceholderPreview.js
        ...templatePlaceholderPreviewData(),
      };
    },
    computed: {
      user() {
        return this.$store.getters["auth/getUser"];
      },
      template() {
        if (this.templateId && this.templateId > 0) {
          return this.$store.getters["table/template/get"](Number(this.templateId));
        }
        return null;
      },
      // quillTemplateToolbar.js (toolbarVisible)
      ...quillTemplateToolbarComputed,
      // templateLanguageSwitching.js (templateDefaultLanguage, languageOptions)
      ...templateLanguageSwitchingComputed,
      // templateContentSync.js (debounceTimeForEdits)
      ...templateContentSyncComputed,
      // templatePlaceholderPreview.js (templateSupportsPlaceholderPreview, previewDisplayHtml)
      ...templatePlaceholderPreviewComputed,

    },
    watch: {
      readOnly: {
        handler(newReadOnly) {
          if (this.editor) {
            this.editor.getEditor().enable(!newReadOnly && !this.previewMode);
            this.syncToolbarFormatVisibility();
          }
        }
      },
      previewMode() {
        if (this.editor) {
          this.editor.getEditor().enable(!this.readOnly && !this.previewMode);
          this.syncToolbarFormatVisibility();
        }
      },
      templateSupportsPlaceholderPreview: {
        handler(supported) {
          if (supported) {
            this.fetchPlaceholderExamples();
            if (this.editor) {
              this.$nextTick(() => {
                const editorId = `editor-container-template-${this.templateId}`;
                this.injectEditPreviewToggle(editorId);
                this.syncEditPreviewPickerLabel();
              });
            }
          }
        },
        immediate: true,
      },
    },
    mounted() {
      const editorId = `editor-container-template-${this.templateId}`;
      const editorContainer = document.getElementById(editorId);

      if (editorContainer) {
        this.editor = new Editor(editorContainer, this.editorOptions);

        if (this.toolbarVisible) {
          const toolbarButtons = document.querySelectorAll(`#${editorId} .ql-toolbar button`);
          toolbarButtons.forEach(button => {
            const format = button.className.match(/ql-(\w+)/);
            if (format) {
              button.setAttribute('title', format[1]);
            }
          });
        }
        this.injectLanguageSelector(editorId);
        this.injectEditPreviewToggle(editorId);
        this.syncEditPreviewPickerLabel();
        this.syncToolbarFormatVisibility();

        this.editor.getEditor().enable(!this.readOnly);
        this.editor.getEditor().on('text-change', this.handleTextChange);

        // Handle placeholder insertion
        this.insertTextHandler = (data) => {
          if (data.templateId === this.templateId) {
            this.insertTextAtCursor(data.text);
          }
        };
        this.eventBus.on("editorInsertText", this.insertTextHandler);

        setTimeout(() => {
          this.emitContentForPlaceholders();
        }, 500);
      }

      this.debouncedProcessDelta = debounce(this.processDelta, this.debounceTimeForEdits);

      // Warn before full-page unload (forced URL / tab close) when edits are unsaved,
      // since the route guard does not run in those cases.
      this.beforeUnloadHandler = this.handleBeforeUnload;
      window.addEventListener("beforeunload", this.beforeUnloadHandler);

      // Load available languages and content
      this.fetchLanguagesAndLoadContent();
    },
    unmounted() {
      this.$emit("preview-mode-change", false);
      this.eventBus.off("editorInsertText", this.insertTextHandler);

      if (this.beforeUnloadHandler) {
        window.removeEventListener("beforeunload", this.beforeUnloadHandler);
        this.beforeUnloadHandler = null;
      }

      // Toolbar-injected DOM (language selector, edit/preview toggle) and its listeners
      this.teardownQuillTemplateToolbar();
    },
    methods: {
      isEditorEmpty() {
        if (!this.editor || typeof this.editor.getEditor !== "function") {
          return false;
        }
        const quill = this.editor.getEditor();
        if (!quill) {
          return false;
        }
        const trimmed = quill.getText().trim();
        return trimmed.length === 0;
      },
      addText(text) {
        if (!text || !this.editor) {
          return;
        }
        this.editor.getEditor().insertText(0, text, "user");
      },
      onPaste(event) {
        if (this.user.acceptStats) {
          const pastedText = (event.clipboardData || window.clipboardData).getData('text');
          if (pastedText) {
            this.$socket.emit("stats", {
              action: "textPasted",
              data: {
                ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep?.id} : {}),
                ...(this.studySessionId ? {studySessionId: this.studySessionId} : {}),
                ...(this.studyStepId ? {studyStepId: this.studyStepId} : {}),
                ...(this.documentId ? {documentId: this.documentId} : {}),
                templateId: this.templateId,
                pastedText: pastedText,
              }
            })
          }
        }
      },
      onCopy(event) {
        if (this.user.acceptStats) {
          const copiedText = (event.clipboardData || window.clipboardData).getData('text');
          if (copiedText) {
            this.$socket.emit("stats", {
              action: "textCopied",
              data: {
                ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep?.id} : {}),
                ...(this.studySessionId ? {studySessionId: this.studySessionId} : {}),
                ...(this.studyStepId ? {studyStepId: this.studyStepId} : {}),
                ...(this.documentId ? {documentId: this.documentId} : {}),
                from: "template-editor",
                templateId: this.templateId,
                copiedText: copiedText,
              }
            })
          }
        }
      },
      async initializeEditorWithContent(deltas) {
        if (this.editor) {
          this.editor.getEditor().setContents(deltas);
        }
        this.templateLoaded = true;
        this.emitContentForPlaceholders();
      },
      // quillTemplateToolbar.js
      ...quillTemplateToolbarMethods,
      // templateLanguageSwitching.js
      ...templateLanguageSwitchingMethods,
      // templateContentSync.js
      ...templateContentSyncMethods,
      // templatePlaceholderPreview.js
      ...templatePlaceholderPreviewMethods,
    }
  };
  </script>

  <style scoped>
.pageLoader {
    position: absolute;
    top: 25%;
    left: 50%;
    transform: translate(-50%, -50%)
  }

.template-viewer-column {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

.template-viewport {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }
</style>
