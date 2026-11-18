  <template>
  <Loader
    v-if="documentId && documentId === 0"
    :loading="true"
    class="pageLoader"
  />
  <span v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
      <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
        <EditorQuillSurface
          :read-only="finalReadOnly"
          @ready="editor = $event"
          @text-change="handleTextChange"
        />
      </div>
    </div>
  </span>
</template>
<script>
/**
 * Editor component
 *
 * This component provides a Quill editor to edit the document: it loads the document with its edits, sends the
 * user's edits (debounced, and once more when the editor closes), applies edits made elsewhere and reports the
 * first and current version as study data.
 *
 * @autor Juliane Bechert, Dennis Zyska, Manu Sundar Raj Nandyal, Zheyu Zhang, Alexander Bürkle
 */
import Quill from "quill";
import debounce from "lodash.debounce";
import {dbToDelta, deltaToDb} from "editor-delta-conversion";
import {downloadDocument, resolveApiMessage} from "@/assets/utils.js";
import Loader from "@/basic/Loading.vue";
import EditorQuillSurface from "./EditorQuillSurface.vue";

const Delta = Quill.import('delta');

// Order of document edits: by creation time, then by their order within one save
const byCreation = (a, b) => (new Date(a.createdAt) - new Date(b.createdAt)) || ((a.order || 0) - (b.order || 0));

export default {
  name: "EditorView",
  components: {
    EditorQuillSurface,
    Loader,
  },
  fetch_data: ["document_edit"],
  subscribeTable: ["document_data"],
  inject: {
    studySessionId: {default: null},
    readOnly: {default: false},
    documentId: {default: 0},
    studyStepId: {default: null},
    pendingNlpInsertion: {default: null},
    currentStudyStep: {default: null},
  },
  emits: ["update:data"],
  data() {
    return {
      documentHash: this.$route.params.documentHash,
      deltaBuffer: [],
      editor: null,
      firstVersion: null,
    };
  },
  computed: {
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
      ).sort(byCreation);
    },
    unappliedEdits() {
      return this.$store.getters["table/document_edit/getFiltered"]((e) => e.applied === false).sort(byCreation);
    },
    appliedEdits() {
      return this.$store.getters["table/document_edit/getFiltered"]((e) => e.applied === true).sort(byCreation);
    },
    debounceTimeForEdits() {
      return parseInt(this.$store.getters["settings/getValue"]("editor.edits.debounceTime"), 10);
    },
  },
  watch: {
    unappliedEdits: {handler: "applyAdditionalEdits", deep: true},
    appliedEdits(newEdits, oldEdits) {
      this.processEdits(newEdits.filter(newEdit => !oldEdits.some(oldEdit => oldEdit.id === newEdit.id)));
    },
  },
  mounted() {
    if (this.editor) {
      this.eventBus.on("editorSelectEdit", this.onSelectEdit);
      this.eventBus.on("editorInsertText", this.onInsertText);
      setTimeout(() => {
        this.emitContentForPlaceholders();
      }, 500);
    }
    this.debouncedProcessDelta = debounce(this.processDelta, this.debounceTimeForEdits);
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
          this.emitVersions();
          if (this.isEditorEmpty() && this.pendingNlpInsertion) {
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
    documentError(error) {
      this.handleDocumentError(error);
    }
  },
  unmounted() {
    this.eventBus.off("editorSelectEdit", this.onSelectEdit);
    this.eventBus.off("editorInsertText", this.onInsertText);

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
      if (this.debouncedProcessDelta) {
        this.debouncedProcessDelta.cancel();
      }
      if (!this.editor || this.deltaBuffer.length === 0) {
        return Promise.resolve();
      }
      return this.sendEdits(this.takeBufferedOps());
    },
    /** Combines the buffered user changes into database ops and empties the buffer. */
    takeBufferedOps() {
      const combinedDelta = this.deltaBuffer.reduce((acc, delta) => acc.compose(delta), new Delta());
      this.deltaBuffer = [];
      return deltaToDb(combinedDelta.ops);
    },
    /**
     * Saves edit ops; if the server rejects them, the editor goes back to its content before the edit.
     * @param {Array} dbOps - the ops to save
     * @returns {Promise<void>} resolves once the server answered
     */
    sendEdits(dbOps) {
      if (dbOps.length === 0) {
        return Promise.resolve();
      }
      const quill = this.editor.getEditor();
      const backup = quill.getContents();
      return new Promise((resolve) => {
        this.$socket.emit("documentEdit", {
          documentId: this.documentId,
          studySessionId: this.studySessionId || null,
          studyStepId: this.studyStepId || null,
          ops: dbOps,
        }, (res) => {
          if (!res.success) {
            quill.setContents(backup);
            this.eventBus.emit("toast", {
              title: this.$t("errors.editor.previousEditFailed"),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
          resolve();
        });
      });
    },
    /** Reports the first and the current version of the document as study data. */
    emitVersions() {
      this.$emit("update:data", {
        firstVersion: this.firstVersion,
        currentVersion: this.editor.getEditor().root.innerHTML,
      });
    },
    isEditorEmpty() {
      const quill = typeof this.editor?.getEditor === "function" ? this.editor.getEditor() : null;
      return !!quill && quill.getText().trim().length === 0;
    },
    clearEditor() {
      this.editor?.getEditor().setContents([{insert: ''}]);
    },
    addText(text) {
      if (!text || !this.editor) {
        return;
      }
      this.editor.getEditor().insertText(0, text, "user");
    },
    onSelectEdit(data) {
      if (data.documentId === this.documentId) {
        this.setEditInEditor(data.editId);
      }
    },
    onInsertText(data) {
      if (data.documentId === this.documentId) {
        this.insertTextAtCursor(data.text);
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
            title: this.$t('errors.editor.cursorPositionError.title'),
            message: this.$t('errors.editor.cursorPositionError.message'),
            variant: "warning",
          });
        }
      }
    },
    emitContentForPlaceholders() {
      if (this.editor) {
        this.eventBus.emit("editorContentUpdated", {documentId: this.documentId, content: this.editor.getEditor().root.innerHTML});
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
      if (this.deltaBuffer.length > 0) {
        this.sendEdits(this.takeBufferedOps());
        this.emitVersions();
      }
    },
    /** Shows edits made elsewhere; the user's own edits are already in the editor. */
    processEdits(edits) {
      edits.filter((edit) => edit.sender !== this.$socket.id)
        .forEach((edit) => this.editor.getEditor().updateContents(dbToDelta([edit]), "api"));
    },
    async initializeEditorWithContent(deltas) {
      if (this.editor) {
        this.editor.getEditor().setContents(deltas);
      }
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
