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
              <div class="template-editor-surface">
                <div
                  v-show="!previewMode"
                  :id="`editor-container-template-${templateId}`"
                  class="template-editor-container"
                  @paste="onPaste"
                  @copy="onCopy"
                >
                </div>
              </div>
            <div
              v-show="previewMode && templateSupportsPlaceholderPreview"
              class="template-example-preview-panel border rounded bg-light"
            >
              <div class="alert alert-info mb-0 rounded-0 py-2 small template-preview-banner">
                {{ $t("templates.editor.viewMode.previewHelp") }}
              </div>
              <div class="ql-snow template-preview-scroll p-3">
                <div
                  class="ql-editor template-example-preview-inner"
                  v-html="previewDisplayHtml"
                ></div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
      <BasicModal
        ref="newLanguageModal"
        name="newLanguage"
        @hide="onNewLanguageModalHide"
      >
        <template #title>
          {{ $t("templates.editor.newLanguage") }}
        </template>
        <template #body>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="newLanguageModalMessage" />
        </template>
        <template #footer>
          <div class="btn-group">
            <BasicButton
              class="btn btn-outline-primary"
              :text="$t('templates.editor.createEmpty')"
              @click="chooseNewLanguageEmpty"
            />
            <BasicButton
              class="btn btn-primary"
              :text="$t('templates.editor.copyContent')"
              @click="chooseNewLanguageCopied"
            />
          </div>
        </template>
      </BasicModal>
    </span>
  </template>
  
  <script>
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
  import BasicModal from "@/basic/Modal.vue";
  import BasicButton from "@/basic/Button.vue";
  import { quillTemplateToolbarData, quillTemplateToolbarComputed, quillTemplateToolbarMethods } from "@/components/editor/template/quillTemplateToolbar.js";
  import { templateLanguageSwitchingData, templateLanguageSwitchingComputed, templateLanguageSwitchingMethods } from "@/components/editor/template/templateLanguageSwitching.js";
  import { templateContentSyncData, templateContentSyncComputed, templateContentSyncMethods } from "@/components/editor/template/templateContentSync.js";
  import { templatePlaceholderPreviewData, templatePlaceholderPreviewComputed, templatePlaceholderPreviewMethods } from "@/components/editor/template/templatePlaceholderPreview.js";

  export default {
    name: "TemplateEditor",
    components: { Loader, BasicModal, BasicButton },
    inject: {
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
      editorOptions() {
        const toolsMap = {
          "editor.toolbar.tools.font": {font: []},
          "editor.toolbar.tools.size": {size: []},
          "editor.toolbar.tools.align": {align: []},
          "editor.toolbar.tools.header": ["header", "1", "2", "3", "4", "5", "6"],
          "editor.toolbar.tools.bold": "bold",
          "editor.toolbar.tools.italic": "italic",
          "editor.toolbar.tools.underline": "underline",
          "editor.toolbar.tools.strike": "strike",
          "editor.toolbar.tools.blockquote": "blockquote",
          "editor.toolbar.tools.code-block": "code-block",
          "editor.toolbar.tools.formula": "formula",
          "editor.toolbar.tools.subscript": {script: "sub"},
          "editor.toolbar.tools.superscript": {script: "super"},
          "editor.toolbar.tools.indent": [{indent: "-1"}, {indent: "+1"}],
          "editor.toolbar.tools.direction": {direction: []},
          "editor.toolbar.tools.color": {color: []},
          "editor.toolbar.tools.background": {background: []},
          "editor.toolbar.tools.orderedList": {list: "ordered"},
          "editor.toolbar.tools.unorderedList": {list: "bullet"},
          "editor.toolbar.tools.checkList": {list: "check"},
          "editor.toolbar.tools.link": "link",
          "editor.toolbar.tools.image": "image",
          "editor.toolbar.tools.video": "video",
          "editor.toolbar.tools.clean": "clean"
        };
  
        const toolbarTools = [];
        const hiddenTools = ['editor.toolbar.tools.formula', 'editor.toolbar.tools.link', 'editor.toolbar.tools.image', 'editor.toolbar.tools.video'];
  
        for (const [key, tool] of Object.entries(toolsMap)) {
          if (hiddenTools.includes(key)) {
            continue;
          }
  
          if (this.$store.getters["settings/getValue"](key) === "true") {
            toolbarTools.push(tool);
          }
        }
  
        // Always pass toolbarTools when setting is on so format buttons are created.
        // readOnly watcher hides/shows them; passing [] when readOnly would leave toolbar with only languages.
        const toolbarContainer = this.$store.getters["settings/getValue"]("editor.toolbar.visibility") === "true"
          ? toolbarTools
          : [];
        return {
          modules: {
            toolbar: { container: toolbarContainer }
          },
          theme: "snow"
        };
      },
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

  .template-editor-surface {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .template-viewport:not(.template-viewport--preview) .template-editor-surface {
    flex: 1 1 auto;
  }

  .template-viewport--preview .template-editor-surface {
    flex: 0 0 auto;
    position: relative;
    z-index: 2;
    overflow: visible;
  }

  .template-example-preview-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    position: relative;
    z-index: 1;
  }

  .template-viewport--preview .template-example-preview-panel {
    flex: 1 1 auto;
  }

  .template-editor-surface .ql-toolbar {
    position: relative;
    z-index: 2;
  }

  .template-editor-container {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .template-editor-surface .ql-container {
    flex: 1;
    min-height: 0;
  }

  .template-preview-banner {
    flex-shrink: 0;
  }

  .template-preview-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }

  .template-example-preview-inner {
    white-space: pre-wrap;
    min-height: 0;
  }
  </style>

  <style>
  .ql-toolbar .ql-languageSelector {
    min-width: 100px;
    background-color: var(--bs-tertiary-bg, #f5f5f5);
    margin-left: 10px;
  }
  .ql-toolbar .ql-languageSelector .ql-picker-label {
    padding: 2px 8px;
  }
  .ql-toolbar .ql-languageSelector .ql-picker-label svg {
    width: 14px;
    height: 14px;
  }

  .ql-toolbar .ql-templateViewMode {
    min-width: 90px;
    background-color: #f5f5f5;
    margin-left: 6px;
  }
  .ql-toolbar .ql-templateViewMode .ql-picker-label {
    padding: 2px 8px;
  }
  .ql-toolbar .ql-templateViewMode .ql-picker-label svg {
    width: 14px;
    height: 14px;
  }

  .ql-toolbar .ql-languageSelector.ql-expanded,
  .ql-toolbar .ql-templateViewMode.ql-expanded {
    z-index: 10;
  }

  .ql-toolbar .ql-languageSelector .ql-picker-options,
  .ql-toolbar .ql-templateViewMode .ql-picker-options {
    z-index: 11;
  }
  </style>
