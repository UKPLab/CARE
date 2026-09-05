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
            class="col border mh-100 justify-content-center p-3"
            style="overflow-y: scroll;"
          >
            <div
              :id="`editor-container-template-${templateId}`"
              @paste="onPaste"
              @copy="onCopy"
            >
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
  import Quill from "quill";
  import "quill/dist/quill.snow.css";
  import debounce from "lodash.debounce";
  import {deltaToDb} from "editor-delta-conversion";
  import {Editor} from "@/components/editor/editorStore.js";
  import Loader from "@/basic/Loading.vue";
  import BasicModal from "@/basic/Modal.vue";
  import { resolveApiMessage } from "@/assets/utils";
  import BasicButton from "@/basic/Button.vue";
  
  const Delta = Quill.import('delta');

  const SUPPORTED_LANGUAGES = [
    { code: "en", labelKey: "common.languages.en" },
    { code: "de", labelKey: "common.languages.de" },
    { code: "fr", labelKey: "common.languages.fr" },
  ];
  
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
    emits: ["update:data"],
    data() {
      return {
        deltaBuffer: [],
        editor: null,
        templateLoaded: false,
        firstVersion: null,
        selectedLanguage: "en",
        availableLanguages: [],
        pendingNewLanguage: null,
        languageSelectorEl: null,
        languageSelectorClickOutside: null,
        newLanguageModalMessage: "",
        beforeUnloadHandler: null,
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
      templateDefaultLanguage() {
        return (this.template && this.template.defaultLanguage) || "en";
      },
      debounceTimeForEdits() {
        return parseInt(this.$store.getters["settings/getValue"]("editor.edits.debounceTime"), 10);
      },
      toolbarVisible() {
        return this.$store.getters["settings/getValue"]("editor.toolbar.visibility") === "true" && !this.readOnly;
      },
      languageOptions() {
        if (this.readOnly) {
          return this.availableLanguages.slice();
        }
        // Available languages first, then supported languages not yet added
        const existing = new Set(this.availableLanguages);
        const options = this.availableLanguages.slice();
        SUPPORTED_LANGUAGES.forEach(({ code }) => {
          if (!existing.has(code)) {
            options.push(code);
          }
        });
        return options;
      },
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
            this.editor.getEditor().enable(!newReadOnly);
            const toolbar = this.editor.getEditor().getModule("toolbar");
            if (toolbar && toolbar.container) {
              toolbar.container.style = "display:block";
              toolbar.container.querySelectorAll('.ql-formats').forEach(el => {
                if (newReadOnly && !el.querySelector('.ql-languageSelector')) {
                  el.style.display = 'none';
                } else {
                  el.style.display = '';
                }
              });
            }
          }
        }
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

        // In read-only mode, hide formatting buttons but keep language selector
        if (this.readOnly) {
          const toolbar = this.editor.getEditor().getModule("toolbar");
          if (toolbar && toolbar.container) {
            toolbar.container.querySelectorAll('.ql-formats').forEach(el => {
              if (!el.querySelector('.ql-languageSelector')) {
                el.style.display = 'none';
              }
            });
          }
        }
  
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
      this.eventBus.off("editorInsertText", this.insertTextHandler);

      if (this.beforeUnloadHandler) {
        window.removeEventListener("beforeunload", this.beforeUnloadHandler);
        this.beforeUnloadHandler = null;
      }

      // Cleanup language selector
      if (this.languageSelectorClickOutside) {
        document.removeEventListener("click", this.languageSelectorClickOutside);
      }
      if (this.languageSelectorEl && this.languageSelectorEl.parentNode) {
        this.languageSelectorEl.parentNode.removeChild(this.languageSelectorEl);
      }
    },
    methods: {
      /**
       * Whether the editor content differs from what was last loaded for this language.
       * @returns {boolean}
       */
      hasUnsavedChanges() {
        if (this.firstVersion === null || !this.editor) {
          return false;
        }
        return this.editor.getEditor().root.innerHTML !== this.firstVersion;
      },
      /**
       * Warn on full-page unload (forced URL navigation / tab close) when there are unsaved edits.
       * @param {BeforeUnloadEvent} event
       */
      handleBeforeUnload(event) {
        if (this.hasUnsavedChanges()) {
          event.preventDefault();
        }
      },
      /**
       * Request close/save of the current language.
       * Used by the route guard so navigation can be blocked when save fails (e.g. missing required placeholders).
       * 
       * @returns {Promise<Object>}
       */
      requestClose() {
        return new Promise((resolve) => {
          this.$socket.emit(
            "templateClose",
            { templateId: this.templateId, language: this.selectedLanguage },
            (res) => resolve(res || { success: false })
          );
        });
      },
      /**
       * Discard draft edits without merging into template_content.
       * Used when leaving after invalid content.
       * 
       * @returns {Promise<Object>}
       */
      requestDiscard() {
        return new Promise((resolve) => {
          this.$socket.emit(
            "templateDiscardDrafts",
            { templateId: this.templateId, language: this.selectedLanguage },
            (res) => resolve(res || { success: false })
          );
        });
      },
      /**
       * Persist any pending debounced edits before close/discard checks.
       *
       * The debounce timer may not have fired yet when the user leaves (topbar back,
       * route navigation). This cancels the timer and sends buffered ops via
       * templateEditContent, waiting for the socket callback before templateClose runs.
       *
       * @returns {Promise<void>}
       */
      flushPendingEdits() {
        if (this.debouncedProcessDelta) {
          this.debouncedProcessDelta.cancel();
        }
        if (!this.editor || this.deltaBuffer.length === 0) {
          return Promise.resolve();
        }
        const quill = this.editor.getEditor();
        const combinedDelta = this.deltaBuffer.reduce((acc, delta) => acc.compose(delta), new Delta());
        const dbOps = deltaToDb(combinedDelta.ops);
        if (dbOps.length === 0) {
          this.deltaBuffer = [];
          return Promise.resolve();
        }
        const backup = quill.getContents();
        return new Promise((resolve) => {
          this.$socket.emit(
            "templateEditContent",
            {
              templateId: this.templateId,
              language: this.selectedLanguage,
              ops: dbOps,
            },
            (res) => {
              if (!res.success) {
                quill.setContents(backup);
                this.eventBus.emit("toast", {
                  title: this.$t("templates.editor.toasts.previousEditFailed"),
                  message: resolveApiMessage(res),
                  variant: "danger",
                });
              }
              const currentVersion = this.editor.getEditor().root.innerHTML;
              this.$emit("update:data", {
                firstVersion: this.firstVersion,
                currentVersion: currentVersion,
              });
              this.deltaBuffer = [];
              resolve();
            }
          );
        });
      },
      fetchLanguagesAndLoadContent() {
        this.$socket.emit("templateGetLanguages", { templateId: this.templateId }, (res) => {
          
          const data = res.success && res.data ? res.data : {};
          const languagesArray = Array.isArray(data) ? data : (data.languages || []);
          const defaultLanguageFromServer = (data && typeof data === "object" && !Array.isArray(data) && data.defaultLanguage) ? data.defaultLanguage : null;

          if (languagesArray.length > 0) {
            this.availableLanguages = languagesArray;
          }

          // Rebuild dropdown options
          this.rebuildLanguageSelectorOptions();

          // Prefer defaultLanguage from server (template row); fallback to store, then "en"
          const defaultLang = defaultLanguageFromServer || this.templateDefaultLanguage || "en";
          this.selectedLanguage = this.availableLanguages.includes(defaultLang)
            ? defaultLang
            : (this.availableLanguages[0] || defaultLang);

          // Update dropdown label 
          this.$nextTick(() => this.updateLanguageSelectorLabel());

          this.loadContentForLanguage(this.selectedLanguage);
        });
      },

      loadContentForLanguage(language) {
        this.$socket.emit("templateGetContent",
          {
            templateId: this.templateId,
            language: language,
          },
          (res) => {
            if (res.success) {
              this.initializeEditorWithContent(res['data']['deltas']);

              // Track if this is a newly added language
              if (res['data']['isNewLanguage']) {
                this.availableLanguages = [...new Set([...this.availableLanguages, language])].sort();
              }

              // Set first version to current
              if (this.editor) {
                let currentVersion = this.editor.getEditor().root.innerHTML;
                this.firstVersion = currentVersion;

                let studyData = {
                  firstVersion: this.firstVersion,
                  currentVersion: currentVersion,
                };
                this.$emit("update:data", studyData);
              }
            } else {
              this.handleTemplateError(res.error || res || { message: this.$t("templates.editor.toasts.failedToLoadTemplate") });
            }
          }
        );
      },

      injectLanguageSelector(editorId) {
        // Quill inserts the toolbar as a sibling before the container, not inside it.
        const containerEl = document.getElementById(editorId);
        const toolbar = containerEl?.parentElement?.querySelector('.ql-toolbar') || document.querySelector(`#${editorId} .ql-toolbar`);
        if (!toolbar) {
          return;
        }

        // Create container span 
        const formats = document.createElement("span");
        formats.className = "ql-formats";

        // Create picker wrapper 
        const wrapper = document.createElement("span");
        wrapper.className = "ql-languageSelector ql-picker";

        const currentLanguage = SUPPORTED_LANGUAGES.find(l => l.code === this.selectedLanguage);
        const currentLabel = currentLanguage ? this.$t(currentLanguage.labelKey) : this.selectedLanguage;
        wrapper.innerHTML = `
          <span class="ql-picker-label" title="${this.$t("templates.editor.language")}">${currentLabel}
            <svg viewBox="0 0 18 18"><polygon class="ql-stroke" points="7 11 9 13 11 11 7 11"></polygon><polygon class="ql-stroke" points="7 7 9 5 11 7 7 7"></polygon></svg>
          </span>
          <span class="ql-picker-options">
            ${this.languageOptions.map(code => {
              const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
              return `<span class="ql-picker-item" data-value="${code}">${lang ? this.$t(lang.labelKey) : code}</span>`;
            }).join("")}
          </span>
        `;

        // Toggle dropdown on label click
        wrapper.addEventListener("click", (e) => {
          const labelEl = wrapper.querySelector(".ql-picker-label");
          if (labelEl && e.target !== labelEl && !labelEl.contains(e.target)) {
            return;
          }
          wrapper.classList.toggle("ql-expanded");
        });

        // Handle option selection
        wrapper.querySelectorAll(".ql-picker-item").forEach(item => {
          item.addEventListener("click", (e) => {
            e.stopPropagation();
            const value = item.dataset.value;
            wrapper.classList.remove("ql-expanded");
            // Update label
            const labelEl = wrapper.querySelector(".ql-picker-label");
            if (labelEl) {
              const lang = SUPPORTED_LANGUAGES.find(l => l.code === value);
              const svg = labelEl.querySelector("svg");
              labelEl.innerHTML = (lang ? this.$t(lang.labelKey) : value) + (svg ? svg.outerHTML : "");
            }
            this.selectLanguage(value);
          });
        });

        // Close dropdown on outside click
        this.languageSelectorClickOutside = (e) => {
          if (!wrapper.contains(e.target)) {
            wrapper.classList.remove("ql-expanded");
          }
        };
        document.addEventListener("click", this.languageSelectorClickOutside);

        formats.appendChild(wrapper);
        toolbar.appendChild(formats);
        this.languageSelectorEl = formats;
      },

      updateLanguageSelectorLabel() {
        const label = this.languageSelectorEl?.querySelector('.ql-picker-label');
        if (label) {
          const lang = SUPPORTED_LANGUAGES.find(l => l.code === this.selectedLanguage);
          const labelText = lang ? this.$t(lang.labelKey) : this.selectedLanguage;
          const svg = label.querySelector("svg");
          label.innerHTML = labelText + (svg ? svg.outerHTML : "");
        }
      },

      rebuildLanguageSelectorOptions() {
        const wrapper = this.languageSelectorEl?.querySelector('.ql-languageSelector');
        if (!wrapper) return;
        const optionsEl = wrapper.querySelector('.ql-picker-options');
        if (!optionsEl) return;
        optionsEl.innerHTML = this.languageOptions.map(code => {
          const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
          return `<span class="ql-picker-item" data-value="${code}">${lang ? this.$t(lang.labelKey) : code}</span>`;
        }).join("");
        wrapper.querySelectorAll(".ql-picker-item").forEach(item => {
          item.addEventListener("click", (e) => {
            e.stopPropagation();
            const value = item.dataset.value;
            wrapper.classList.remove("ql-expanded");
            const labelEl = wrapper.querySelector(".ql-picker-label");
            if (labelEl) {
              const lang = SUPPORTED_LANGUAGES.find(l => l.code === value);
              const svg = labelEl.querySelector("svg");
              labelEl.innerHTML = (lang ? this.$t(lang.labelKey) : value) + (svg ? svg.outerHTML : "");
            }
            this.selectLanguage(value);
          });
        });
      },

      selectLanguage(value) {
        if (!value || value === this.selectedLanguage) {
          return;
        }
        if (this.readOnly) {
          this.selectedLanguage = value;
          this.loadContentForLanguage(value);
          this.$nextTick(() => this.updateLanguageSelectorLabel());
          return;
        }
        const isNew = !this.availableLanguages.includes(value);
        if (isNew) {
          this.pendingNewLanguage = value;
          this.newLanguageModalMessage = this.$t("templates.editor.newLanguageMessage");
          this.$refs.newLanguageModal.openModal();
        } else {
          this.saveCurrentAndSwitchTo(value);
        }
      },

      onNewLanguageModalHide() {
        if (this.pendingNewLanguage) {
          this.$nextTick(() => this.updateLanguageSelectorLabel());
          this.pendingNewLanguage = null;
        }
      },

      chooseNewLanguageEmpty() {
        const value = this.pendingNewLanguage;
        this.$refs.newLanguageModal.close();
        this.pendingNewLanguage = null;
        if (value) this.addLanguageAndSwitch(value, false);
      },

      chooseNewLanguageCopied() {
        const value = this.pendingNewLanguage;
        this.$refs.newLanguageModal.close();
        this.pendingNewLanguage = null;
        if (value) this.addLanguageAndSwitch(value, true);
      },

      addLanguageAndSwitch(newLang, copyContent) {
        // Save current language first; only add language if save succeeded
        this.$socket.emit("templateClose",
          { templateId: this.templateId, language: this.selectedLanguage },
          (closeRes) => {
            if (!closeRes.success) {
              this.eventBus.emit("toast", {
                title: this.$t("templates.editor.toasts.templateSaveFailed"),
                message: resolveApiMessage(closeRes),
                variant: "danger"
              });
              return;
            }
            const content = (copyContent && this.editor) ? this.editor.getEditor().getContents() : undefined;
            this.$socket.emit("templateAddLanguageContent",
              {
                templateId: this.templateId,
                language: newLang,
                content: (content && content.ops) ? { ops: content.ops } : undefined
              },
              (res) => {
                if (res.success) {
                  this.availableLanguages = [...new Set([...this.availableLanguages, newLang])].sort();
                  this.selectedLanguage = newLang;
                  this.loadContentForLanguage(newLang);
                  this.$nextTick(() => this.updateLanguageSelectorLabel());
                } else {
                  this.eventBus.emit("toast", {
                    title: this.$t("templates.editor.toasts.failedToAddLanguage"),
                    message: resolveApiMessage(res),
                    variant: "danger"
                  });
                }
              }
            );
          }
        );
      },

      saveCurrentAndSwitchTo(newLang) {
        // Save current language, then switch only if save succeeded
        this.$socket.emit("templateClose",
          { templateId: this.templateId, language: this.selectedLanguage },
          (res) => {
            if (!res.success) {
              this.eventBus.emit("toast", {
                title: this.$t("templates.editor.toasts.templateSaveFailed"),
                message: resolveApiMessage(res),
                variant: "danger"
              });
              return;
            }
            this.selectedLanguage = newLang;
            this.loadContentForLanguage(newLang);
            this.$nextTick(() => this.updateLanguageSelectorLabel());
          }
        );
      },

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
      insertTextAtCursor(text) {
        if (this.editor) {
          const quill = this.editor.getEditor();
          const range = quill.getSelection();
          if (range) {
            const placeholderDelta = new Delta().retain(range.index).insert(text);
            quill.updateContents(placeholderDelta);
            this.deltaBuffer.push(placeholderDelta);
            this.debouncedProcessDelta();
            quill.setSelection(range.index + text.length);
  
            this.emitContentForPlaceholders();
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("templates.editor.toasts.noCursorPosition.title"),
              message: this.$t("templates.editor.toasts.noCursorPosition.message"),
              variant: "warning",
            });
          }
        }
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
      emitContentForPlaceholders() {
        if (this.editor) {
          const content = this.editor.getEditor().root.innerHTML;
          this.eventBus.emit("editorContentUpdated", {
            templateId: this.templateId,
            content: content,
          });
        }
      },
      handleTextChange(delta, oldContents, source) {
        if (source === "user") {
          this.deltaBuffer.push(delta);
          this.debouncedProcessDelta();
          this.emitContentForPlaceholders();
        }
      },
      processDelta() {
        const quill = this.editor.getEditor();
        if (this.deltaBuffer.length > 0) {
          let combinedDelta = this.deltaBuffer.reduce((acc, delta) => acc.compose(delta), new Delta());
          let dbOps = deltaToDb(combinedDelta.ops);        
          if (dbOps.length > 0) {
            const backup = quill.getContents();
  
            this.$socket.emit("templateEditContent", {
              templateId: this.templateId,
              language: this.selectedLanguage,
              ops: dbOps
            }, (res) => {
              if (!res.success) {
                quill.setContents(backup);
                this.eventBus.emit("toast", {
                  title: this.$t("templates.editor.toasts.previousEditFailed"),
                  message: resolveApiMessage(res),
                  variant: "danger",
                });
              }
            });
          }
  
          let currentVersion = this.editor.getEditor().root.innerHTML;
          let studyData = {
            firstVersion: this.firstVersion,
            currentVersion: currentVersion,
          };
          this.$emit("update:data", studyData);
          this.deltaBuffer = [];
        }
      },
      async initializeEditorWithContent(deltas) {
        if (this.editor) {
          this.editor.getEditor().setContents(deltas);
        }
        this.templateLoaded = true;
        this.emitContentForPlaceholders();
      },
      handleTemplateError(error) {
        this.eventBus.emit('toast', {
        title: this.$t("templates.editor.toasts.templateError"),
        message: resolveApiMessage(error),
        variant: "danger"
      });
      },
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
  </style>
