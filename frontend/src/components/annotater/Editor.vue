<template>
  <QuillEditor v-model:content="content" content-type="html" theme="snow" :on-update:content="contentChanged()" />
</template>
  
<script>
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css';
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
      editable_document: undefined,
    }
  },
  mounted() {
    // Get or create editable document for this document
    this.$socket.emit("editableDocumentGetOrCreateForDocument", { documentId: this.documentId, text: "" });
  },
  sockets: {
    editable_docRefresh: function (data) {
      // If eidtable document is not initialized and data is not empty
      if (this.editable_document === undefined && data.length > 0) {
        // then set eidtable document and content
        this.editable_document = data[0];
        this.content = this.editable_document.text;
      }
    }
  },
  methods: {
    contentChanged() {
      // Only write changes if editable document is loaded and text is changed
      if (this.editable_document !== undefined && this.editable_document.text !== this.content) {
        // Update editable document 
        this.editable_document.text = this.content;
        console.log(this.editable_document);
        this.$socket.emit("editableDocumentSilentUpdate", this.editable_document);
      }
    }
  }
}
</script>
