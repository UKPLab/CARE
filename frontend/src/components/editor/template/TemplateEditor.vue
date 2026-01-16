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
    </span>
  </template>
  
  <script>
  /**
   * Template Editor component
   *
   * Simplified Quill editor for editing template content.
   * Unlike document editor, templates don't have edit history, subscriptions, or document_edit table.
   *
   * @author Mohammad Elwan
   */
  import Quill from "quill";
  import "quill/dist/quill.snow.css";
  import debounce from "lodash.debounce";
  import {dbToDelta, deltaToDb} from "editor-delta-conversion";
  import {Editor} from "@/components/editor/editorStore.js";
  import Loader from "@/basic/Loading.vue";
  
  const Delta = Quill.import('delta');
  
  export default {
    name: "TemplateEditor",
    components: { Loader },
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
      };
    },
    computed: {
      user() {
        return this.$store.getters["auth/getUser"];
      },
      debounceTimeForEdits() {
        return parseInt(this.$store.getters["settings/getValue"]("editor.edits.debounceTime"), 10);
      },
      toolbarVisible() {
        return this.$store.getters["settings/getValue"]("editor.toolbar.visibility") === "true" && !this.readOnly;
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
  
        return {
          modules: {
            toolbar: this.toolbarVisible ? {container: toolbarTools} : false
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
            if (newReadOnly) {
              this.editor.getEditor().getModule("toolbar").container.style = "display:none"
            } else {
              this.editor.getEditor().getModule("toolbar").container.style = "display:block"
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
      
      // Load template content
      this.$socket.emit("templateGetContent",
        {
          templateId: this.templateId,
        },
        (res) => {
          if (res.success) {
            this.initializeEditorWithContent(res['data']['deltas']);

            // Set first version to current (templates don't have history)
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
    unmounted() {
      this.eventBus.off("editorInsertText", this.insertTextHandler);

      // Save template on close (like documents do)
      // This triggers merging of draft edits into stable content
      this.$socket.emit("templateClose", { templateId: this.templateId }, (res) => {
        if (!res.success) {
          console.error("Template close error:", res.message);
        }
      });
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
  </style>