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
          style="overflow-y: scroll; position: relative;"
        >
          <div v-if="saveFailed" class="alert alert-danger" role="alert">
            {{ $t('errors.editor.saveRecovery') }}
            <BasicButton class="btn-outline-danger" :disabled="saveInFlight || recovering" @click="recoverSavedContent">
              {{ $t('errors.editor.reloadSaved') }}
            </BasicButton>
          </div>
          <BasicButton v-if="failedDraft" class="btn-outline-secondary" @click="downloadFailedDraft">
            {{ $t('errors.editor.downloadDraft') }}
          </BasicButton>
          <!-- Read-Only Toolbar Bar -->
          <div
            v-if="!toolbarVisible && finalReadOnly"
            class="readonly-toolbar-bar"
          >
            <LoadIcon icon-name="lock-fill" :size="16" />
            <span class="readonly-toolbar-text">{{ $t('editor.readOnlyMode') }}</span>
          </div>
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
import {dbToDelta, deltaToDb} from "editor-delta-conversion";
import {Editor} from "@/components/editor/editorStore.js";
import {downloadDocument, resolveApiMessage} from "@/assets/utils.js";
import LoadIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";

const Delta = Quill.import('delta');

export default {
  name: "EditorView",
  components: {
    LoadIcon,
    BasicButton,
  },
  fetch_data: ["document_edit"],
  subscribeTable: ["document_data"],
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
    pendingNlpInsertion: {
      default: null,
    },
    currentStudyStep: {
      type: Object,
      required: false,
      default: null
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
      saveInFlight: null,
      saveTimer: null,
      saveFailed: false,
      recovering: false,
      failedDraft: '',
      recoveryRevision: 0,
      recoverySelection: null,
      recoveryTimer: null,
      recoveryRequest: 0,
      disposed: false,
      contextVersion: 0,
    };
  },
  computed: {
    user() {
      return this.$store.getters["auth/getUser"];
    },
    componentReadOnly() {
      return this.currentStudyStep?.configuration?.readOnlyComponents?.includes('editor') || false;
    },
    finalReadOnly() {
      return this.readOnly || this.componentReadOnly;
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
      return this.$store.getters["settings/getValue"]("editor.toolbar.visibility") === "true" && !this.finalReadOnly;
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
    documentId() { this.invalidateSaveContext(); },
    studySessionId() { this.invalidateSaveContext(); },
    studyStepId() { this.invalidateSaveContext(); },
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
    
    finalReadOnly: {
      handler(newReadOnly) {
        this.editor.getEditor().enable(!newReadOnly && !this.saveFailed);
        const toolbar = this.editor.getEditor().getModule("toolbar");
        if (toolbar && toolbar.container) {
          if (newReadOnly) {
            toolbar.container.style = "display:none"
          } else {
            toolbar.container.style = "display:block"
          }
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

      this.editor.getEditor().enable(!this.finalReadOnly);
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

      setTimeout(() => {
        this.emitContentForPlaceholders();
      }, 500);
    }
    this.debouncedProcessDelta = debounce(this.processDelta, this.debounceTimeForEdits);
    const initialVersion = this.contextVersion;
    this.$socket.emit("documentGet",
      {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId
      },
      (res) => {
        if (this.disposed || initialVersion !== this.contextVersion) return;
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
           if(this.isEditorEmpty() && this.pendingNlpInsertion){
            this.addText(this.pendingNlpInsertion);
          }
        } else {
          this.handleDocumentError(res.error);
        }
      }
    );


    this.$socket.emit("documentSubscribe", { documentId: this.documentId });
  },
  sockets: {
    connect() {
      this.$socket.emit("documentOpen", {documentId: this.documentId}, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.documents.documentOpenError'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    disconnect() {
      if (this.saveInFlight || this.deltaBuffer.length) this.pauseFailedSave();
    },
    documentError(error) {
      this.handleDocumentError(error);
    }
  },
  unmounted() {
    this.disposed = true;
    clearTimeout(this.recoveryTimer);
    this.eventBus.off("editorSelectEdit", this.selectEditHandler);
    this.eventBus.off("editorInsertText", this.insertTextHandler);
    this.eventBus.off('editorApplyGeneratedFeedback', this.applyGeneratedFeedbackHandler);

    this.flushPendingEdits()
      .catch(() => {})
      .finally(() => {
        this.$socket.emit("documentClose", {documentId: this.documentId, studySessionId: this.studySessionId}, (res) => {
          if (!res.success) {
            this.eventBus.emit("toast", {
              title: this.$t('errors.documents.documentCloseError'),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
        });
        this.$socket.emit("documentUnsubscribe", { documentId: this.documentId });
      });
  },
  methods: {
    /**
     * Persist any pending debounced edits before documentClose.
     *
     * The debounce timer may not have fired yet when the editor unmounts. This
     * cancels the timer and sends buffered ops via documentEdit, waiting for the
     * socket callback before close (and saveDocument for regular documents).
     *
     * @returns {Promise<void>}
     */
    flushPendingEdits() {
      this.debouncedProcessDelta?.cancel();
      return Promise.resolve(this.saveInFlight).then(() => {
        if (this.saveFailed || !this.deltaBuffer.length) return;
        return Promise.resolve(this.processDelta()).then(() => this.flushPendingEdits());
      });
    },
    /** Stop callbacks and buffered positions from crossing document contexts. */
    invalidateSaveContext() {
      this.contextVersion++;
      this.recoveryRequest++;
      clearTimeout(this.recoveryTimer);
      this.recovering = false;
      this.debouncedProcessDelta?.cancel();
      this.deltaBuffer = [];
      this.saveFailed = true;
      this.editor?.getEditor().enable(false);
    },
    /** Keep the visible draft, but never send positions based on a failed edit. */
    pauseFailedSave() {
      this.saveFailed = true;
      this.debouncedProcessDelta?.cancel();
      this.deltaBuffer = [];
      this.recoverySelection = this.editor.getEditor().getSelection() || this.recoverySelection;
      this.failedDraft = this.editor.getEditor().root.innerHTML;
      this.editor.getEditor().enable(false);
    },
    /** Export the unconfirmed draft without replaying possibly committed operations. */
    downloadFailedDraft() {
      downloadDocument(this.failedDraft, `${this.documentHash || this.documentId}.html`, "text/html");
    },
    /** Read behind earlier received writes before replacing the paused draft. */
    recoverSavedContent() {
      if (this.saveInFlight || this.recovering || this.disposed) return;
      this.recovering = true;
      const version = this.contextVersion;
      const revision = this.recoveryRevision;
      const request = ++this.recoveryRequest;
      this.recoveryTimer = setTimeout(() => {
        this.recoveryRequest++;
        this.recovering = false;
      }, 10000);
      this.$socket.emit("documentRecover", {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
      }, async (res) => {
        if (this.disposed || version !== this.contextVersion || request !== this.recoveryRequest) return;
        clearTimeout(this.recoveryTimer);
        this.recovering = false;
        if (!res.success) { this.handleDocumentError(res.error); return; }
        // A concurrent broadcast can straddle the snapshot. Fetch again instead
        // of applying an operation which the snapshot may already contain.
        if (revision !== this.recoveryRevision) { this.recoverSavedContent(); return; }
        const quill = this.editor.getEditor();
        const selection = this.recoverySelection;
        const contents = new Delta(res.data.deltas);
        const change = quill.getContents().diff(contents);
        quill.setContents(contents, "api");
        quill.history.clear();
        if (selection) {
          const start = change.transformPosition(selection.index);
          const end = change.transformPosition(selection.index + selection.length);
          quill.setSelection(start, end - start, "silent");
        }
        // The snapshot includes these persisted edits. Let the store watchers
        // settle while paused so they cannot apply them for a second time.
        if (this.unappliedEdits.length) this.$store.commit("table/document_edit/SOCKET_document_editRefresh",
          this.unappliedEdits.map(edit => ({id: edit.id, applied: true})));
        await this.$nextTick();
        if (this.disposed || version !== this.contextVersion || request !== this.recoveryRequest) return;
        if (revision !== this.recoveryRevision) { this.recoverSavedContent(); return; }
        this.saveFailed = false;
        quill.enable(!this.finalReadOnly);
        this.publishEditorContent();
      });
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
    clearEditor() {
      if (this.editor) {
        const quill = this.editor.getEditor();
        quill.setContents([{insert: ''}]);
      }
    },
    addText(text) {
      if (this.saveFailed || !text || !this.editor) {
        return;
      }
      this.editor.getEditor().insertText(0, text, "user");
    },
    setEditInEditor(editId) {
      const index = this.allEdits.findIndex((edit) => edit.id === editId);
      const edits = (index !== -1) ? this.allEdits.slice(0, index + 1) : this.allEdits;

      const delta = dbToDelta(edits);
      this.clearEditor();
      this.editor.getEditor().updateContents(delta, "api");
    },
    insertTextAtCursor(text) {
      if (this.editor && !this.saveFailed) {
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
            title: this.$t('errors.editor.cursorPositionError.title'),
            message: this.$t('errors.editor.cursorPositionError.message'),
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
              studyStepId: this.studyStepId,
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
              from: "editor",
              documentId: this.documentId,
              studySessionId: this.studySessionId,
              studyStepId: this.studyStepId,
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
          documentId: this.documentId,
          content: content,
        });
      }
    },
    handleTextChange(delta, oldContents, source) {
      if (source === "user" && !this.saveFailed) {
        this.deltaBuffer.push(delta);
        this.debouncedProcessDelta();

        this.emitContentForPlaceholders();
      }
    },
    /** Send one batch at a time; later typing remains buffered until acknowledgement. */
    processDelta() {
      if (this.saveFailed || this.saveInFlight || !this.deltaBuffer.length) return this.saveInFlight;
      const combinedDelta = this.deltaBuffer.reduce((acc, delta) => acc.compose(delta), new Delta());
      this.deltaBuffer = [];
      const ops = deltaToDb(combinedDelta.ops);
      if (!ops.length) return;
      const version = this.contextVersion;
      let finish;
      const pending = new Promise(resolve => { finish = resolve; });
      this.saveInFlight = pending;
      this.saveTimer = setTimeout(() => {
        this.saveFailed = true;
        this.deltaBuffer = [];
        if (!this.disposed && version === this.contextVersion) this.pauseFailedSave();
        this.saveInFlight = null;
        finish();
      }, 10000);
      this.$socket.emit("documentEdit", {
        documentId: this.documentId,
        studySessionId: this.studySessionId || null,
        studyStepId: this.studyStepId || null,
        ops,
      }, (res) => {
        // A timed-out write may acknowledge after recovery or a newer save.
        if (this.saveInFlight !== pending) return;
        clearTimeout(this.saveTimer);
        this.saveInFlight = null;
        if (version === this.contextVersion) {
          if (!res?.success) {
            if (!this.disposed) this.pauseFailedSave();
            this.deltaBuffer = [];
            this.eventBus.emit("toast", {
              title: this.$t('errors.editor.previousEditFailed'),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          } else if (!this.saveFailed) {
            this.processDelta();
          }
        }
        finish();
      });
      this.publishEditorContent();
      return pending;
    },
    /** Keep study data and placeholder consumers in sync with displayed content. */
    publishEditorContent() {
      this.$emit("update:data", {
        firstVersion: this.firstVersion,
        currentVersion: this.editor.getEditor().root.innerHTML,
      });
      this.emitContentForPlaceholders();
    },
    processEdits(edits) {
      if (this.saveFailed) { this.recoveryRevision++; return; }
      edits.forEach((edit) => {
              if (!(edit.sender === this.$socket.id)) {
              const delta = dbToDelta([edit]);
              this.editor.getEditor().updateContents(delta, "api");
              }
            })
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
      if (this.saveFailed) { this.recoveryRevision++; return; }
      if (this.unappliedEdits.length > 0) {
        const delta = dbToDelta(this.unappliedEdits);
        this.editor.getEditor().updateContents(delta, "api");
        this.$store.commit("table/document_edit/SOCKET_document_editRefresh",
          this.unappliedEdits.map(edit => ({id: edit.id, applied: true})));
      }
    },
    handleDocumentError(error) {
      this.eventBus.emit('toast', {
        title: this.$t('errors.documents.documentError'),
        message: error.message,
        variant: "danger"
      });
    },
    downloadDocumentAsHTML() {
      const editorContent = this.editor.getEditor().root.innerHTML;
      const document = this.$store.getters["table/document/getByHash"](this.documentHash);
      const documentName = document ? document.name : this.$t('documents.documentDefaultName');
      const fileName = `${documentName}.html`;
      downloadDocument(editorContent, fileName, "text/html");
    },
  }
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