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
                Example values only — not live data. Layout matches the editor where placeholders appear as plain text in HTML.
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
          New language
        </template>
        <template #body>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="newLanguageModalMessage" />
        </template>
        <template #footer>
          <div class="btn-group">
            <BasicButton
              class="btn btn-outline-primary"
              text="Create Empty"
              @click="chooseNewLanguageEmpty"
            />
            <BasicButton
              class="btn btn-primary"
              text="Copy Content"
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
  import BasicButton from "@/basic/Button.vue";
  import {buildExamplePreviewHtml, mapPlaceholderPreviewRows} from "@/components/editor/template/placeholderExamplePreview.js";
  
  const Delta = Quill.import('delta');

  const SUPPORTED_LANGUAGES = [
    { code: "en", label: "English" },
    { code: "de", label: "Deutsch" },
    { code: "fr", label: "Français" },
  ];

  const VIEW_MODE_LABELS = {
    edit: "Edit",
    preview: "Preview",
  };

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
        previewMode: false,
        lastEditorHtml: "",
        placeholderPreviewList: [],
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
      templateSupportsPlaceholderPreview() {
        const t = this.template;
        if (!t || t.type == null) {
          return false;
        }
        return [1, 2, 3, 6, 7, 8].includes(t.type);
      },
      previewDisplayHtml() {
        if (!this.previewMode || !this.templateSupportsPlaceholderPreview) {
          return "";
        }
        return buildExamplePreviewHtml(this.lastEditorHtml, this.placeholderPreviewList, {
          bracketOnly: this.template?.type === 8,
        });
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

      if (this.editPreviewClickOutside) {
        document.removeEventListener("click", this.editPreviewClickOutside);
        this.editPreviewClickOutside = null;
      }

      // Cleanup language selector (includes view-mode picker when present)
      if (this.languageSelectorClickOutside) {
        document.removeEventListener("click", this.languageSelectorClickOutside);
      }
      if (this.languageSelectorEl && this.languageSelectorEl.parentNode) {
        this.languageSelectorEl.parentNode.removeChild(this.languageSelectorEl);
        this.languageSelectorEl = null;
        this.editPreviewPickerEl = null;
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
                  title: "Previous edit failed; try again",
                  message: res.message,
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
              this.handleTemplateError(res.error || { message: res.message || "Failed to load template" });
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

        const currentLabel = SUPPORTED_LANGUAGES.find(l => l.code === this.selectedLanguage)?.label || this.selectedLanguage;
        wrapper.innerHTML = `
          <span class="ql-picker-label" title="Language">${currentLabel}
            <svg viewBox="0 0 18 18"><polygon class="ql-stroke" points="7 11 9 13 11 11 7 11"></polygon><polygon class="ql-stroke" points="7 7 9 5 11 7 7 7"></polygon></svg>
          </span>
          <span class="ql-picker-options">
            ${this.languageOptions.map(code => {
              const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
              return `<span class="ql-picker-item" data-value="${code}">${lang ? lang.label : code}</span>`;
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
              labelEl.innerHTML = (lang ? lang.label : value) + (svg ? svg.outerHTML : "");
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

      /**
       * Inject Edit / Preview picker next to the language selector on the Quill toolbar.
       *
       * @param {string} editorId
       */
      injectEditPreviewToggle(editorId) {
        if (!this.templateSupportsPlaceholderPreview) {
          return;
        }
        const containerEl = document.getElementById(editorId);
        const toolbar = containerEl?.parentElement?.querySelector(".ql-toolbar") || document.querySelector(`#${editorId} .ql-toolbar`);
        if (!toolbar) {
          return;
        }

        let formats = this.languageSelectorEl;
        if (!formats) {
          formats = document.createElement("span");
          formats.className = "ql-formats";
          toolbar.appendChild(formats);
          this.languageSelectorEl = formats;
        }

        formats.setAttribute("data-template-preview-toggle", "true");

        if (formats.querySelector(".ql-templateViewMode")) {
          return;
        }

        const wrapper = document.createElement("span");
        wrapper.className = "ql-templateViewMode ql-picker";

        const currentMode = this.previewMode ? "preview" : "edit";
        const currentLabel = VIEW_MODE_LABELS[currentMode];
        wrapper.innerHTML = `
          <span class="ql-picker-label" title="View mode">${currentLabel}
            <svg viewBox="0 0 18 18"><polygon class="ql-stroke" points="7 11 9 13 11 11 7 11"></polygon><polygon class="ql-stroke" points="7 7 9 5 11 7 7 7"></polygon></svg>
          </span>
          <span class="ql-picker-options">
            <span class="ql-picker-item" data-value="edit">${VIEW_MODE_LABELS.edit}</span>
            <span class="ql-picker-item" data-value="preview">${VIEW_MODE_LABELS.preview}</span>
          </span>
        `;

        wrapper.addEventListener("click", (e) => {
          const labelEl = wrapper.querySelector(".ql-picker-label");
          if (labelEl && e.target !== labelEl && !labelEl.contains(e.target)) {
            return;
          }
          wrapper.classList.toggle("ql-expanded");
        });

        wrapper.querySelectorAll(".ql-picker-item").forEach(item => {
          item.addEventListener("click", (e) => {
            e.stopPropagation();
            const value = item.dataset.value;
            wrapper.classList.remove("ql-expanded");
            const labelEl = wrapper.querySelector(".ql-picker-label");
            if (labelEl) {
              const svg = labelEl.querySelector("svg");
              labelEl.innerHTML = (VIEW_MODE_LABELS[value] || value) + (svg ? svg.outerHTML : "");
            }
            this.setPreviewMode(value === "preview");
          });
        });

        if (this.editPreviewClickOutside) {
          document.removeEventListener("click", this.editPreviewClickOutside);
        }
        this.editPreviewClickOutside = (e) => {
          if (!wrapper.contains(e.target)) {
            wrapper.classList.remove("ql-expanded");
          }
        };
        document.addEventListener("click", this.editPreviewClickOutside);

        formats.appendChild(wrapper);
        this.editPreviewPickerEl = wrapper;
        this.syncEditPreviewPickerLabel();
      },

      syncEditPreviewPickerLabel() {
        const wrapper = this.editPreviewPickerEl;
        if (!wrapper) {
          return;
        }
        const label = wrapper.querySelector(".ql-picker-label");
        if (label) {
          const mode = this.previewMode ? "preview" : "edit";
          const svg = label.querySelector("svg");
          label.innerHTML = (VIEW_MODE_LABELS[mode] || mode) + (svg ? svg.outerHTML : '<svg viewBox="0 0 18 18"><polygon class="ql-stroke" points="7 11 9 13 11 11 7 11"></polygon><polygon class="ql-stroke" points="7 7 9 5 11 7 7 7"></polygon></svg>');
        }
      },

      fetchPlaceholderExamples() {
        if (!this.templateId || this.templateId <= 0) {
          return;
        }
        this.$socket.emit("templatePlaceholderGetAll", { templateId: this.templateId }, (result) => {
          if (result.success) {
            this.placeholderPreviewList = mapPlaceholderPreviewRows(result.data);
          } else {
            this.eventBus.emit("toast", {
              title: "Failed to load placeholders",
              message: result.message || "Unknown error",
              variant: "danger",
            });
          }
        });
      },

      /**
       * Toggle between Quill edit and example-value HTML preview.
       *
       * @param {boolean} on
       */
      setPreviewMode(on) {
        this.previewMode = !!on;
        if (this.previewMode && this.editor) {
          this.lastEditorHtml = this.editor.getEditor().root.innerHTML;
        }
        if (this.editor) {
          this.editor.getEditor().enable(!this.readOnly && !this.previewMode);
        }
        this.syncEditPreviewPickerLabel();
        this.syncToolbarFormatVisibility();
        this.$emit("preview-mode-change", this.previewMode);
      },

      /**
       * In read-only or example preview, hide formatting controls; keep language + view mode pickers.
       */
      syncToolbarFormatVisibility() {
        if (!this.editor) {
          return;
        }
        const toolbar = this.editor.getEditor().getModule("toolbar");
        if (!toolbar?.container) {
          return;
        }
        const compactToolbar = this.readOnly || this.previewMode;
        toolbar.container.style.display = "block";
        toolbar.container.querySelectorAll(".ql-formats").forEach((el) => {
          const keepVisible =
            el.querySelector(".ql-languageSelector") ||
            el.querySelector("[data-template-preview-toggle]") ||
            el.getAttribute("data-template-preview-toggle") === "true";
          el.style.display = compactToolbar && !keepVisible ? "none" : "";
        });
      },

      updateLanguageSelectorLabel() {
        const label = this.languageSelectorEl?.querySelector('.ql-picker-label');
        if (label) {
          const lang = SUPPORTED_LANGUAGES.find(l => l.code === this.selectedLanguage);
          const labelText = lang ? lang.label : this.selectedLanguage;
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
          return `<span class="ql-picker-item" data-value="${code}">${lang ? lang.label : code}</span>`;
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
              labelEl.innerHTML = (lang ? lang.label : value) + (svg ? svg.outerHTML : "");
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
          this.newLanguageModalMessage = "A new language is being added for this template. Copy current content into this language?<br><br><strong>Leaving the current language will save the content in it.</strong>";
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
                title: "Template save failed",
                message: closeRes.message || "",
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
                    title: "Failed to add language",
                    message: res.message || "",
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
                title: "Template save failed",
                message: res.message || "",
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
              title: "No Cursor Position",
              message: "Please click in the editor to set the cursor position before inserting a placeholder.",
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
          this.lastEditorHtml = content;
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
                  title: "Previous edit failed; try again",
                  message: res.message,
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
          title: "Template error",
          message: error.message,
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
    background-color: #f5f5f5;
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
