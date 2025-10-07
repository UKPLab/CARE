<template>
  <Loader
    v-if="documentId && documentId === 0"
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
            :id="`editor-container-${studyStepId}`"
            @paste="onPaste"
            @copy="onCopy"
          >
          </div>
        </div>
      </div>
    </div>
  </span>

  <Teleport to="#topBarNavItems">
    <TopBarButton
      v-if="showHTMLDownloadButton"
      v-show="studySessionId && studySessionId !== 0 ? active : true"
      title="Download document"
      class="btn rounded-circle"
      type="button"
      @click="downloadDocumentAsHTML"
    >
      <LoadIcon
        :color="'#777777'"
        :size="18"
        icon-name="download"
      />
    </TopBarButton>
  </Teleport>
</template>
<script>
/**
 * Editor component
 *
 * This component provides a Quill editor to edit the document.
 *
 * @autor Juliane Bechert, Dennis Zyska, Manu Sundar Raj Nandyal, Zheyu Zhang, Alexander Bürkle
 */
import Quill from "quill";
import "quill/dist/quill.snow.css";
import debounce from "lodash.debounce";
import LoadIcon from "@/basic/Icon.vue";
import {dbToDelta, deltaToDb} from "editor-delta-conversion";
import {Editor} from "@/components/editor/editorStore.js";
import {downloadDocument} from "@/assets/utils.js";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";

const Delta = Quill.import('delta');

export default {
  name: "EditorView",
  fetch_data: ["document_edit"],
  subscribeTable: ["document_data"],
  components: {
    LoadIcon, TopBarButton
  },
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null
    },
    userId: {
      type: Number,
      required: false,
      default: null
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    studyData: {
      type: Array,
      required: false,
      default: () => [],
    },
    documentId: {
      type: Number,
      required: true,
      default: 0,
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
    active: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  emits: ["update:data"],
  data() {
    return {
      documentHash: this.$route.params.documentHash,
      deltaBuffer: [],
      deltaDataBuffer: [],
      editor: null,
      documentLoaded: false,
      data: {},
      firstVersion: null,
      feedbackLoaded: false,
      pendingFeedbackText: '',
    };
  },
  computed: {
    user() {
      return this.$store.getters["auth/getUser"];
    },
    allEdits() {
      return this.$store.getters["table/document_edit/getFiltered"](
        (e) => e.documentId === this.documentId
          && e.studySessionId === this.studySessionId
          && e.studyStepId === this.studyStepId
      ).sort((a, b) => {
        const timeCompare = new Date(a.createdAt) - new Date(b.createdAt);
        if (timeCompare !== 0) return timeCompare;
        return (a.order || 0) - (b.order || 0);
      });
    },
    unappliedEdits() {
      return this.$store.getters["table/document_edit/getFiltered"](
        (e) => e.applied === false
      ).sort((a, b) => {
        const timeCompare = new Date(a.createdAt) - new Date(b.createdAt);
        if (timeCompare !== 0) return timeCompare;
        return (a.order || 0) - (b.order || 0);
      });
    },
    appliedEdits() {
      return this.$store.getters["table/document_edit/getFiltered"](
        (e) => e.applied === true
      ).sort((a, b) => {
        const timeCompare = new Date(a.createdAt) - new Date(b.createdAt);
        if (timeCompare !== 0) return timeCompare;
        return (a.order || 0) - (b.order || 0);
      });
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
      // hide some tools, because the functionalities have not been handled: formula, link, image, video
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
    showHTMLDownloadButton() {
      return this.$store.getters["settings/getValue"]("editor.toolbar.showHTMLDownload") === "true";
    },
    studySteps() {
      if (this.studyStepId !== null) {
        const studyId = this.$store.getters['table/study_step/get'](this.studyStepId)?.studyId;
        return this.$store.getters['table/study_step/getByKey']("studyId", studyId);
      } else {
        return [];
      }
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
  },
  watch: {
    unappliedEdits: {
      handler(newEdits) {
        if (newEdits.length > 0) {
          this.applyAdditionalEdits();
        }
      },
      deep: true
    },
    appliedEdits(newEdits, oldEdits) {
        const appliedEdits = newEdits.filter(newEdit =>
          !oldEdits.some(oldEdit => oldEdit.id === newEdit.id)
        )
        this.processEdits(appliedEdits);
    },
    
    readOnly: {
      handler(newReadOnly) {
        this.editor.getEditor().enable(!newReadOnly);
        if (newReadOnly) {
          this.editor.getEditor().getModule("toolbar").container.style = "display:none"
        } else {
          this.editor.getEditor().getModule("toolbar").container.style = "display:block"
        }

      }
    },
  },
  created() {
    this.documentHash = this.$route.params.documentHash;
  },
  mounted() {
    const editorId = `editor-container-${this.studyStepId}`;
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
      // Store event handler references for cleanup
      this.selectEditHandler = (data) => {
        if (data.documentId === this.documentId) {
          this.setEditInEditor(data.editId);
        }
      };
      this.eventBus.on("editorSelectEdit", this.selectEditHandler);

      this.insertTextHandler = (data) => {
        if (data.documentId === this.documentId) {
          this.insertTextAtCursor(data.text);
        }
      };
      this.eventBus.on("editorInsertText", this.insertTextHandler);

      // Handle generated feedback application from StepModal
      this.applyGeneratedFeedbackHandler = (data) => {
        if (data.documentId === this.documentId && this.editor && !this.feedbackLoaded) {
          const feedbackText = data.feedbackText || '';
          if (!feedbackText) return;

          if (!this.documentLoaded) {
            this.pendingFeedbackText = feedbackText;
            return;
          }
          this.applyFeedbackText(feedbackText);
        }
      };
      this.eventBus.on('editorApplyGeneratedFeedback', this.applyGeneratedFeedbackHandler);

      setTimeout(() => {
        this.emitContentForPlaceholders();
      }, 500);
    }

    this.$socket.emit("documentGet",
      {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId
      },
      (res) => {
        if (res.success) {
          this.initializeEditorWithContent(res['data']['deltas']);

          let quill = new Quill(document.createElement('div'));
          quill.setContents(res['data']['firstVersion']);
          this.firstVersion = quill.root.innerHTML;
          let currentVersion = this.editor.getEditor().root.innerHTML;

          let studyData = {
            firstVersion: this.firstVersion,
            currentVersion: currentVersion,
          };
          this.$emit("update:data", studyData);
          // Generated feedback will be applied via event from StepModal
          // If feedback arrived early, apply it now after content initialization
          if (!this.feedbackLoaded && this.pendingFeedbackText) {
            this.applyFeedbackText(this.pendingFeedbackText);
          }

          // Also fetch any previously saved generated feedback in case the event was missed
          this.$socket.emit("documentDataGet", {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            key: 'generating_feedback_data'
          }, (response) => {
            const rawVal = (response && response.success && response.data && response.data.value)
              ? response.data.value
              : (response && response.value) ? response.value : null;
            if (!this.feedbackLoaded && rawVal) {
              const feedbackText = typeof rawVal === 'string'
                ? rawVal
                : (rawVal.textual_feedback || rawVal.feedback || rawVal.text || (typeof rawVal.data === 'string' ? rawVal.data : ''));
              if (feedbackText) {
                this.applyFeedbackText(feedbackText);
              }
            }
          });
        } else {
          this.handleDocumentError(res.error);
        }
      }
    );

    this.debouncedProcessDelta = debounce(this.processDelta, this.debounceTimeForEdits);

    this.$socket.emit("documentSubscribe", { documentId: this.documentId });
  },
  sockets: {
    connect() {
      this.$socket.emit("documentOpen", {documentId: this.documentId}, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: "Document Open Error",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    documentError(error) {
      this.handleDocumentError(error);
    }
  },
  unmounted() {
    this.eventBus.off("editorSelectEdit", this.selectEditHandler);
    this.eventBus.off("editorInsertText", this.insertTextHandler);
    this.eventBus.off('editorApplyGeneratedFeedback', this.applyGeneratedFeedbackHandler);

    this.$socket.emit("documentClose", {documentId: this.documentId, studySessionId: this.studySessionId}, (res) => {
      if (!res.success) {
        this.eventBus.emit("toast", {
          title: "Document Close Error",
          message: res.message,
          variant: "danger",
        });
      }
    });
    this.$socket.emit("documentUnsubscribe", { documentId: this.documentId });
  },
  methods: {
    applyFeedbackText(feedbackText) {
      const editorInstance = this.editor && this.editor.getEditor ? this.editor.getEditor() : null;
      if (!editorInstance || !feedbackText) return;

      const currentContent = editorInstance.getContents();
      if (currentContent.ops.length <= 1 && (!currentContent.ops[0].insert || currentContent.ops[0].insert === '\n')) {
        editorInstance.setText(feedbackText);
      } else {
        const insertText = feedbackText.endsWith('\n') ? feedbackText : feedbackText + '\n\n';
        editorInstance.updateContents(new Delta().retain(0).insert(insertText), 'api');
      }
      this.firstVersion = editorInstance.root.innerHTML;
      const currentVersion = editorInstance.root.innerHTML;
      this.$emit("update:data", {
        firstVersion: this.firstVersion,
        currentVersion: currentVersion,
      });
      this.feedbackLoaded = true;
      this.pendingFeedbackText = '';
    },
    clearEditor() {
      if (this.editor) {
        const quill = this.editor.getEditor();
        quill.setContents([{insert: ''}]);
      }
    },
    setEditInEditor(editId) {
      const index = this.allEdits.findIndex((edit) => edit.id === editId);
      const edits = (index !== -1) ? this.allEdits.slice(0, index + 1) : this.allEdits;

      const delta = dbToDelta(edits);
      this.clearEditor();
      this.editor.getEditor().updateContents(delta, "api");
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
              documentId: this.documentId,
              studySessionId: this.studySessionId,
              pastedText: pastedText,
              acceptDataSharing: this.user.acceptDataSharing
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
              documentId: this.documentId,
              studySessionId: this.studySessionId,
              copiedText: copiedText,
              acceptDataSharing: this.user.acceptDataSharing
            }
          })
        }
      }
    },
    emitContentForPlaceholders() {
      if (this.editor) {
        const content = this.editor.getEditor().root.innerHTML;
        this.eventBus.emit("editorContentUpdated", {
          documentId: this.documentId,
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

          this.$socket.emit("documentEdit", {
            documentId: this.documentId,
            studySessionId: this.studySessionId || null,
            studyStepId: this.studyStepId || null,
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
    processEdits(edits) {
      edits.forEach((edit) => {
              if (!(edit.sender == this.$socket.id)) {
              const delta = dbToDelta([edit]);
              this.editor.getEditor().updateContents(delta, "api");
              }
            })
    },

    async leave() {
      if (this.document_edits && this.document_edits.length > 0 && this.document_edits.filter(edit => edit.draft).length > 0) {
        return new Promise((resolve, reject) => {
          this.$refs.leavePageConf.open(
            "Unsaved Changes",
            "Are you sure you want to leave? There are unsaved changes, which will be lost.",
            null,
            function (val) {
              return resolve(val);
            }
          );
        });
      } else {
        return true;
      }
    },
    async initializeEditorWithContent(deltas) {
      if (this.editor) {
        this.editor.getEditor().setContents(deltas);
      }
      this.documentLoaded = true;
      this.applyAdditionalEdits();

      this.emitContentForPlaceholders();
    },
    applyAdditionalEdits() {
      if (this.unappliedEdits.length > 0) {
        const delta = dbToDelta(this.unappliedEdits);
        this.editor.getEditor().updateContents(delta, "api");
        this.$store.commit("table/document_edit/applyEdits", this.unappliedEdits.map((edit) => edit.id));
      }
    },
    handleDocumentError(error) {
      this.eventBus.emit('toast', {
        title: "Document error",
        message: error.message,
        variant: "danger"
      });
    },
    downloadDocumentAsHTML() {
      const editorContent = this.editor.getEditor().root.innerHTML;
      const document = this.$store.getters["table/document/getByHash"](this.documentHash);
      const documentName = document ? document.name : "document";
      const fileName = `${documentName}.html`;
      downloadDocument(editorContent, fileName, "text/html");
    },
  }
};
</script>

<style scoped>

</style>