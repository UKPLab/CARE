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
          <QuillEditor ref="editor" v-model:content="content" :options="editorOptions" @text-change="handleTextChange"/>
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
 * @autor Zheyu Zhang, Juliane Bechert
 */
import { Delta, QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import debounce from "lodash.debounce";
import LoadIcon from "@/basic/Icon.vue";
import { dbToDelta, deltaToDb, deltaToHtml, concatDeltas } from "editor-delta-conversion";

export default {
  name: "EditorView",
  fetch_data: ["document_edit"],
  components: {
    LoadIcon,
    QuillEditor
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
      deltaBuffer: []
    };
  },
  created() {
    this.documentHash = this.$route.params.documentHash;
  },
  mounted() {
    this.$socket.emit("documentGet", { documentId: this.documentId });

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
    this.$socket.emit("documentSave", { documentId: this.documentId });
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
    handleTextChange({ delta, oldContents, source }) {
      if (source === "user") {
        this.deltaBuffer.push(delta);
        this.debouncedProcessDelta();
      }
    },
    processDelta() {
      if (this.deltaBuffer.length > 0) {
        const combinedDelta = this.deltaBuffer.reduce((acc, delta) => acc.concat(delta), new Delta());
        console.log(combinedDelta.ops);
        console.log(deltaToDb(combinedDelta.ops));
        this.$socket.emit("documentEdit", { documentId: this.documentId, ops: deltaToDb(combinedDelta.ops) });
        this.deltaBuffer = []; // Clear the buffer after processing
        
        /* Code to collect data for testing
        // Prepare data for download
        const htmlContent = this.$refs.editor.getHTML();
          const outputData = {
            delta: combinedDelta,
            html: htmlContent,
            dbEntries: deltaToDb(combinedDelta.ops)
          };

          // Convert the data to a JSON string
          const jsonData = JSON.stringify(outputData, null, 2);

          // Create a Blob from the JSON string
          const blob = new Blob([jsonData], { type: "application/json" });

          // Create a URL for the Blob and trigger the download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'data.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          */
          this.deltaBuffer = []; // Clear the buffer after processing
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
      console.log("Edits:", edits);
      
      const delta = dbToDelta(edits);
      console.log("Converted Deltas:", delta);
      
      const concatDelta = concatDeltas(delta);
      console.log("Concatenated Delta:", concatDelta);
      
      this.content = concatDelta;

      if (this.$refs.editor) {
        console.log("Updating contents with delta:", concatDelta);
        this.$refs.editor.setContents(concatDelta, "silent"); // updateContents does not work due to the format of the deltas
      }

      this.$store.commit("table/document_edit/applyEdits", edits.map(edit => edit.id));
    },
    handleDocumentError(error) {
      alert(`Error: ${error.message}`);
    },
    downloadDocument() {
      var blob = new Blob([this.$refs.editor.getHTML()], { type: "text/html;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
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