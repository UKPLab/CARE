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
          <div id="editor-container"
          @paste="onPaste"
          @copy="onCopy">
          </div>
        </div>
      </div>
    </div>
  </span>

  <Teleport v-if="showHTMLDownloadButton" to="#topBarNavItems">
    <!-- Editor History Button (Only for Admins) -->
    <TopBarButton
      v-if="isAdmin"
      title="Editor History"
      class="btn rounded-circle ms-2"
      type="button"
      @click="openHistoryModal"
    >
      <LoadIcon
        :color="'#777777'"
        :size="18"
        icon-name="eyeglasses"
      />
    </TopBarButton>

    <!-- Download Button -->
    <TopBarButton
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

  <!-- Editor History Modal  -->
  <BasicModal ref="historyModal" name="EditorHistoryModal">
    <template #title>
      Enter Parameters for Editor History
    </template>

    <template #body>
      <div v-if="historyParams"> <!-- Ensures this only appears when modal is opened -->
        <div class="mb-3">
          <label class="form-label">Document History Hash</label>
          <input v-model="historyParams.documentHistoryHash" type="text" class="form-control" placeholder="Enter Document History Hash">
        </div>
        <div class="mb-3">
          <label class="form-label">Study Session Hash</label>
          <input v-model="historyParams.studySessionHash" type="text" class="form-control" placeholder="Enter Study Session Hash">
        </div>
        <div class="mb-3">
          <label class="form-label">Step ID</label>
          <input v-model="historyParams.stepId" type="number" class="form-control" placeholder="Enter Step ID">
        </div>
      </div>
    </template>

    <template #footer>
      <button class="btn btn-secondary" @click="$refs.historyModal.close()">Cancel</button>
      <button class="btn btn-primary" @click="goToEditorHistory">Go to Editor History</button>
    </template>
  </BasicModal>
</template>
<script>
/**
 * Editor component
 *
 * This component provides a Quill editor to edit the document.
 *
 * @autor Juliane Bechert, Zheyu Zhang, Dennis Zyska, Manu Sundar Raj Nandyal, Alexander Bürkle
 */
import Quill from "quill";
import "quill/dist/quill.snow.css";
import debounce from "lodash.debounce";
import LoadIcon from "@/basic/Icon.vue";
import { dbToDelta, deltaToDb } from "editor-delta-conversion";
import { Editor } from './editorStore.js';
import { downloadDocument } from "@/assets/utils.js";
import {computed} from "vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import BasicModal from "@/basic/Modal.vue";

const Delta = Quill.import('delta');

export default {
  name: "EditorView",
  fetch_data: ["document_edit"],
  components: {
    LoadIcon, BasicModal
  },
  provide() {
    return {
      documentId: computed(() => this.documentId),
      studyStepId: computed(()=> this.studyStepId)
    }
  },
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null // Allows for null if not in a study session
    },
    userId: {
      type: Number,
      required: false,
      default: null
    },
    readonly: {
      type: Boolean,
      required: false,
      default: false, // Default to false if not provided
    },
  },
  props: {
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
  data() {
    return {
      content: "",
      documentHash: this.$route.params.documentHash,
      deltaBuffer: [],
      editor: null,
      documentLoaded: false,
      historyParams: null,
    };
  },
  created() {
    this.documentHash = this.$route.params.documentHash;
    
  },
  mounted() {
    const editorContainer = document.getElementById('editor-container');

    if (editorContainer) {
      this.editor = new Editor(editorContainer, this.editorOptions);

      if (this.toolbarVisible) {
        const toolbarButtons = document.querySelectorAll('.ql-toolbar button');
        toolbarButtons.forEach(button => {
          const format = button.className.match(/ql-(\w+)/);
          if (format) {
            button.setAttribute('title', format[1]);
          }
        });
      }

      this.editor.getEditor().on('text-change', this.handleTextChange);
      this.editor.getEditor().enable(!this.readonly);
    }

    this.$socket.emit("documentGet",
      { documentId: this.documentId ,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId },
      (res) => {
        if (res.success) {
          this.initializeEditorWithContent(res['data']['deltas']);
        } else {
          this.handleDocumentError(res.error);
        }
      }
    );

    this.debouncedProcessDelta = debounce(this.processDelta, this.debounceTimeForEdits);
  },
  sockets: {
    connect() {
      this.$socket.emit("documentOpen", { documentId: this.documentId });
    },
    documentError(error) {
      this.handleDocumentError(error);
    }
  },
  unmounted() {
    this.$socket.emit("documentClose", { documentId: this.documentId, studySessionId: this.studySessionId });
  },
  computed: {
    user() {
      return this.$store.getters["auth/getUser"];
    },
    unappliedEdits() {
      return this.$store.getters["table/document_edit/getFiltered"](
        (e) => e.applied === false
      ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    },
    debounceTimeForEdits() {
      return parseInt(this.$store.getters["settings/getValue"]("editor.edits.debounceTime"), 10);
    },
    toolbarVisible() {
      return this.$store.getters["settings/getValue"]("editor.toolbar.visibility") === "true" && !this.readonly;
    },
    editorOptions() {
      const toolsMap = {
        "editor.toolbar.tools.font": { font: [] },
        "editor.toolbar.tools.size": { size: [] },
        "editor.toolbar.tools.align": { align: [] },
        "editor.toolbar.tools.header": ["header", "1", "2", "3", "4", "5", "6"],
        "editor.toolbar.tools.bold": "bold",
        "editor.toolbar.tools.italic": "italic",
        "editor.toolbar.tools.underline": "underline",
        "editor.toolbar.tools.strike": "strike",
        "editor.toolbar.tools.blockquote": "blockquote",
        "editor.toolbar.tools.code-block": "code-block",
        "editor.toolbar.tools.formula": "formula",
        "editor.toolbar.tools.subscript": { script: "sub" },
        "editor.toolbar.tools.superscript": { script: "super" },
        "editor.toolbar.tools.indent": [{ indent: "-1" }, { indent: "+1" }],
        "editor.toolbar.tools.direction": { direction: [] },
        "editor.toolbar.tools.color": { color: [] },
        "editor.toolbar.tools.background": { background: [] },
        "editor.toolbar.tools.orderedList": { list: "ordered" },
        "editor.toolbar.tools.unorderedList": { list: "bullet" },
        "editor.toolbar.tools.checkList": { list: "check" },
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
          toolbar: this.toolbarVisible ? { container: toolbarTools } : false
        },
        theme: "snow"
      };
    },
    showHTMLDownloadButton() {
      return this.$store.getters["settings/getValue"]("editor.toolbar.showHTMLDownload") === "true";
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
    readonly: {
      handler(newReadOnly) {
        this.editor.getEditor().enable(!newReadOnly);
      }
    }
  },
  methods: {
    openHistoryModal() {
      this.historyParams = { 
        documentHistoryHash: "",
        studySessionHash: "",
        stepId: "",
      };
      this.$refs.historyModal.open();
    },
    goToEditorHistory() {
      if (!this.historyParams.documentHistoryHash || !this.historyParams.studySessionHash || !this.historyParams.stepId) {
        this.eventBus.emit("toast", {
          title: "Error",
          message: "Please enter all required fields.",
          variant: "danger",
        });
        return;
      }

      this.$router.push(`/history/${this.historyParams.documentHistoryHash}/${this.historyParams.studySessionHash}/${this.historyParams.stepId}`);
      this.$refs.historyModal.close();
      this.historyParams = null; // Reset after use
    },
    insertTextAtCursor(text) {
      if (this.editor) {
        const quill = this.editor.getEditor();
        const range = quill.getSelection();
        if (range) {
          const editDelta = new Delta().retain(range.index).insert(text);
          quill.updateContents(editDelta);
          this.deltaBuffer.push(editDelta);
          this.debouncedProcessDelta();
          quill.setSelection(range.index + text.length);
        } else {
          this.eventBus.emit("toast", {
            title: "No Cursor Position",
            message: "Please click in the editor to set the cursor position before inserting an edit.",
            variant: "warning",
          });
        }
      }
    },
    onPaste(event) {
      if(this.user.acceptStats) {
      const pastedText = (event.clipboardData || window.clipboardData).getData('text');
      if (pastedText) {
        this.$socket.emit("stats", {
          action: "textPasted",
          data: {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            pastedText: pastedText,
            acceptDataSharing: this.user.acceptDataSharing
          }})
    }}},
    onCopy(event) {
      if(this.user.acceptStats) {
      const copiedText = (event.clipboardData || window.clipboardData).getData('text');
      if (copiedText) {
        this.$socket.emit("stats", {
          action: "textCopied",
          data: {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            copiedText: copiedText,
            acceptDataSharing: this.user.acceptDataSharing
          }})
    }}},
    handleTextChange(delta, oldContents, source) {
      if (source === "user") {
        this.deltaBuffer.push(delta);
        this.debouncedProcessDelta();
      }
    },
    processDelta() {
      if (this.deltaBuffer.length > 0) {
        const combinedDelta = this.deltaBuffer.reduce((acc, delta) => acc.compose(delta), new Delta());
        const dbOps = deltaToDb(combinedDelta.ops);
        if (dbOps.length > 0) {
          this.$socket.emit("documentEdit", {
            documentId: this.documentId,
            studySessionId: this.studySessionId || null,
            studyStepId: this.studyStepId || null,
            ops: dbOps
          });
        }

        this.deltaBuffer = [];
      }
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
    initializeEditorWithContent(deltas) {
      this.content = deltas;

      if (this.editor) {
        this.editor.getEditor().setContents(deltas);
      }
      this.documentLoaded = true;
      this.applyAdditionalEdits();
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
    }
  }
};
</script>

<style scoped>

</style>