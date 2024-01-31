<template>
  <QuillEditor v-model:content="content" theme="snow" @text-change="handleTextChange" />
</template>

<script>
/**
 * Editor component
 * 
 * This component provides a Quill editor to edit the document.
 * 
 * @author Zheyu Zhang
 */
import { Delta, QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import debounce from "lodash.debounce";

export default {
  name: "EditorComponent",
  components: {
    QuillEditor
  },
  props: {
    documentId: {
      type: Number,
      required: true,
    },
  },
  data() {
    return {
      content: "",
      originalContent: undefined,
      editable_document: undefined,
      debounceHandleSave: undefined,
      documentHash: undefined
    };
  },
  created() {
    this.debounceHandleSave = debounce(() => {
      this.contentChanged();
    }, 2000);

    // Get route param
    this.documentHash = this.$route.params.documentHash;
  },
  mounted() {
    // Get or create editable document for this document
    this.$socket.emit("editableDocumentGetOrCreateForDocument", {
      documentId: this.documentId,
      docHash: this.documentHash
    });
  },
  unmounted() {
    this.syncDocDataFromDiffData();
  },
  sockets: {
    editable_docRefresh: function (data) {
      // If eidtable document is not initialized and data is not empty
      if (this.editable_document === undefined && data.length > 0) {
        // then set eidtable document and content
        this.editable_document = data[0];
        this.content = new Delta(this.editable_document.text);
        this.originalContent = this.editable_document.text;
      }
    }
  },
  methods: {
    contentChanged() {
      // Only write changes if editable document is loaded and text is changed
      if (this.editable_document !== undefined && this.editable_document.text !== this.content) {
        // Get document diff data
        const diffData = this.getDiffData(this.editable_document.text, this.content);

        // Update editable document
        this.editable_document.text = this.content;

        // Save document data and diff data
        this.$socket.emit("editableDocumentSilentUpdate", {
          document: this.editable_document,
          diff: diffData
        });
      }
    },
    handleTextChange({ delta, source, oldContents }) {
      if (source === "user") {
        this.$socket.emit("saveDiffData", {
          editableDocId: this.editable_document.documentId,
          diffData: delta
        });
      }
    },
    syncDocDataFromDiffData() {
      this.$socket.emit("syncDocDataFromDiffData", {
        editableDocId: this.editable_document.documentId
      });
    }
  }
};
</script>
