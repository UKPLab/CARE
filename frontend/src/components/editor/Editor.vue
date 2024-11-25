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

  <Teleport v-if="readonly" to="#topBarNavItems">
    <button
        title="Read-Only mode"
        class="btn rounded-circle"
        type="button"
    >
      <LoadIcon
          :size="18"
          :color="'#008000'"
          icon-name="file-earmark-lock2-fill"
      />
    </button>
  </Teleport>

  <Teleport v-if="showHTMLDownloadButton" to="#topBarNavItems">
    <button
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
    </button>
  </Teleport>
  
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

const Delta = Quill.import('delta');

export default {
  name: "EditorView",
  fetch_data: ["document_edit"],
  components: {
    LoadIcon,
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
  },
  data() {
    return {
      content: "",
      documentHash: this.$route.params.documentHash,
      deltaBuffer: [],
      editor: null,
      documentLoaded: false,
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
      console.log("Socket connected:", this.$socket.id);
      this.$socket.emit("documentOpen", { documentId: this.documentId });
    },
    documentError(error) {
      console.error("Document error:", error.message);
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
    }
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