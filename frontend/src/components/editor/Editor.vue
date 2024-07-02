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
          <div id="editor-container"></div>
        </div>
      </div>
    </div>
  </span>

  <Teleport v-if="showHTMLDownloadButton" to="#topBarNavItems">
    <button
      title="Download document"
      class="btn rounded-circle"
      type="button"
      @click="downloadDocument"
    >
      <LoadIcon
        :color="'#777777'"
        :size="18"
        icon-name="download"
      />
    </button>
  </Teleport>
</template>

<script>
/**
 * Editor component
 *
 * This component provides a Quill editor to edit the document.
 *
 * @autor Juliane Bechert, Zheyu Zhang, Dennis Zyska
 */
import Quill from "quill";
import "quill/dist/quill.snow.css";
import debounce from "lodash.debounce";
import LoadIcon from "@/basic/Icon.vue";
import {dbToDelta, deltaToDb} from "editor-delta-conversion";
import {Editor} from './editorStore.js';

const Delta = Quill.import('delta');

export default {
  name: "EditorView",
  fetch_data: ["document_edit"],
  components: {
    LoadIcon
  },
  inject: {
    documentId: {
      default: 0
    },
    studySessionId: {
      default: null
    },
    userId: {
      default: null
    }
  },
  data() {
    return {
      content: "",
      originalContent: undefined,
      editable_document: undefined,
      debounceHandleSave: undefined,
      documentHash: this.$route.params.documentHash,
      deltaBuffer: [],
      editor: null
    };
  },
  created() {
    this.documentHash = this.$route.params.documentHash;
  },
  mounted() {
    const editorContainer = document.getElementById('editor-container');

    if (editorContainer) {
      this.editor = new Editor(editorContainer, {
        theme: "snow",
        modules: this.editorOptions.modules
      });
    }

    this.editor.getEditor().on('text-change', this.handleTextChange);

    this.$socket.emit("documentGet", {documentId: this.documentId});

    this.$socket.on("document_editRefresh", edits => {
      this.initializeEditorWithContent(edits);
    });

    this.$socket.on("documentError", error => {
      console.error("Document error:", error.message);
      this.handleDocumentError(error);
    });

    this.$socket.on("connect", () => {
      console.log("Socket connected:", this.$socket.id);
    });

    this.debouncedProcessDelta = debounce(this.processDelta, this.debounceTimeForEdits);
  },
  unmounted() {
    this.$socket.emit("documentSave", {documentId: this.documentId});
  },
  computed: {
    unappliedEdits() {
      return this.$store.getters["table/document_edit/getFiltered"](
        e => e.applied === false
      ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    },
    debounceTimeForEdits() {
      return parseInt(this.$store.getters["settings/getValue"]("editor.edits.debounceTime"), 10);
    },
    editorOptions() {
      const toolbarVisible = this.$store.getters["settings/getValue"]("editor.toolbar.visibility") === "true";
      return {
        modules: {
          toolbar: toolbarVisible ? undefined : false // Use false to hide, undefined to show default toolbar
        },
        theme: "snow"
      };
    },
    showHTMLDownloadButton() {
      return this.$store.getters["settings/getValue"]("editor.toolbar.showHTMLDownload") === "true";
    }
  },
  watch: {
    unappliedEdits: {
      handler(newEdits) {
        if (newEdits.length > 0) {
          this.initializeEditorWithContent(newEdits);
        }
      },
      deep: true
    }
  },
  methods: {
    handleTextChange(delta, oldContents, source) {
      console.log("Delta receives from editor:", delta);
      if (source === "user") {
        this.deltaBuffer.push(delta);
        this.debouncedProcessDelta();
      }
    },
    processDelta() {
      if (this.deltaBuffer.length > 0) {
        const combinedDelta = this.deltaBuffer.reduce((acc, delta) => acc.compose(delta), new Delta());
        console.log("Combined Delta:", combinedDelta);

        const dbOps = deltaToDb(combinedDelta.ops);
        console.log("Operations to be saved in DB:", dbOps);

        if (dbOps.length > 0) {
          this.$socket.emit("documentEdit", {documentId: this.documentId, ops: dbOps});
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
    initializeEditorWithContent(edits) {
      console.log("Edits to initialize:", edits);

      const unappliedEdits = edits.filter(edit => !edit.applied);
      const delta = dbToDelta(unappliedEdits);
      console.log("Converted Deltas to initialize:", delta);

      this.content = delta;

      if (this.editor) {
        this.editor.getEditor().setContents(new Delta()); 
        
        this.editor.getEditor().updateContents(delta, "api");
        
      }

      this.$store.commit("table/document_edit/applyEdits", edits.map(edit => edit.id));
    },
    handleDocumentError(error) {
      alert(`Error: ${error.message}`);
    },
    downloadDocument() {
      const blob = new Blob([this.editor.root.innerHTML], {type: "text/html;charset=utf-8;"});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.setAttribute("href", url);
      anchor.setAttribute("target", "_blank");
      anchor.style.visibility = "hidden";
      anchor.setAttribute("download", "document.html");
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  }
};
</script>

<style scoped>
/* This targets the toolbar part of the Quill editor and hides it */
.ql-toolbar {
  display: none;
}
</style>
