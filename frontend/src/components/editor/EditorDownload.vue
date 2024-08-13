<template>
  <div id="editor-container" style="visibility:hidden;"></div>
</template>

<script>
import { downloadDocument } from "@/assets/utils.js";
import { Editor } from '@/components/editor/editorStore.js';

export default {
  name: "EditorDownload",
  data() {
    return {
      editor: null,
      currentDocumentId: null,
      pendingExport: null,
    };
  },
  mounted() {
    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
      this.editor = new Editor(editorContainer, {
        theme: "snow",
        modules: {
          toolbar: false,
        },
      });
    }
  },
  sockets: {
    mergedDocumentFile(data) {
      this.initializeEditorWithContent(data.deltas);
      if (this.pendingExport) {
        this.pendingExport();
        this.pendingExport = null;
      }
    },
  },
  methods: {
    async exportDeltaDoc(row) {
      try {
        this.currentDocumentId = row.id;
        await this.fetchMergedDocumentData(row.id);
        const delta = this.editor.getEditor().getContents();
        const content = JSON.stringify(delta);
        const fileName = `${row.name}_delta.json`;
        downloadDocument(content, fileName, "application/json");
      } catch (error) {
        console.error("Error exporting delta document:", error);
      }
    },
    async exportHTMLDoc(row) {
      try {
        this.currentDocumentId = row.id;
        await this.fetchMergedDocumentData(row.id);
        const html = this.editor.getEditor().root.innerHTML;
        const fileName = `${row.name}.html`;
        downloadDocument(html, fileName, "text/html");
      } catch (error) {
        console.error("Error exporting HTML document:", error);
      }
    },
    fetchMergedDocumentData(documentId) {
      return new Promise((resolve) => {
        this.pendingExport = resolve;
        this.$socket.emit("sendMergedDeltas", { documentId });
      });
    },
    initializeEditorWithContent(deltas) {
      if (this.editor && deltas && deltas.ops && deltas.ops.length > 0) {
        this.editor.getEditor().setContents(deltas);
      } else {
        console.warn("No deltas to initialize the editor with.");
      }
    },
  },
};
</script>

<style scoped>
#editor-container {
  visibility: hidden;
}
</style>