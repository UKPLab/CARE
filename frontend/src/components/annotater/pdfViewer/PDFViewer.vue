<template>
  <div
    id="pdfContainer"
    class="has-transparent-text-layer"
  >
    <PDFPage
      v-for="page in pdf.pageCount"
      :key="'PDFPageKey' + page"
      :document-id="documentId"
      :page-number="page"
      :study-session-id="studySessionId"
      :pdf="pdf"
      :render="renderCheck[page - 1]"
      class="scrolling-page"
      @updateVisibility="updateVisibility"
    />
    <Adder
      v-if="!readonly"
      :document-id="documentId"
      :pdf="pdf"
      :study-session-id="studySessionId"
    />
  </div>
</template>

<script>

import PDFPage from "./PDFPage.vue";
import {PDF} from './pdfStore.js';
import * as pdfjsLib from "pdfjs-dist/build/pdf.js"
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";

import Adder from "./Adder.vue";
import {mapMutations} from "vuex";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* PDF Viewer

This component holds the PDF Pages and the all interacting vue components.
Central PDF View component.

Author: Dennis Zyska
*/
export default {
  name: "PDFViewer",
  components: {PDFPage, Adder},
  props: {
    documentId: {
      type: Number,
      required: true
    },
    'studySessionId': {
      type: Number,
      required: false,
      default: 0
    },
    readonly: {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  data() {
    return {
      pdf: new PDF(),
      observer: undefined,
      pdfContainer: null,
      visiblePages: [1],
    }
  },
  computed: {
    renderCheck() {
      let minPage = Math.max(Math.min(...this.visiblePages) - 3, 1);
      let maxPage = Math.min(Math.max(...this.visiblePages) + 3, this.pdf.pageCount);

      return [...Array(this.pdf.pageCount).keys()].map((page) => (page + 1 >= minPage && page + 1 <= maxPage));
    },
  },
  watch: {
    scrollTo() {
      if (this.scrollTo !== null) {
        this.scrollTo = null;
      }
    },
  },
  sockets: {
    documentFile: function (data) {
      if (data.document.id === this.documentId) {
        const loadingTask = pdfjsLib.getDocument(data.file);
        loadingTask.promise
            .then((pdf) => {
              this.pdf.setPDF(pdf);
            })
            .catch(response => {
              this.eventBus.emit('toast', {
                title: "PDF Loading Error",
                message: "Error during loading of the PDF file. Make sure the file is not corrupted and in valid PDF format.",
                variant: "danger"
              });
              this.$router.push("/");
            });
      }
    }
  },
  mounted() {
    this.$socket.emit("documentGet", {documentId: this.documentId});
  },
  methods: {
    updateVisibility(page) {
      if (page.isVisible) {
        if (!this.visiblePages.includes(page.pageNumber)) {
          this.visiblePages.push(page.pageNumber);
        }
      } else {
        if (this.visiblePages.includes(page.pageNumber)) {
          this.visiblePages.splice(this.visiblePages.indexOf(page.pageNumber), 1);
        }
      }
      this.$socket.emit("stats", {
        action: "pdfPageVisibilityChange",
        data: {
          documentId: this.documentId,
          readonly: this.readonly,
          visibility: page,
          studySessionId: this.studySessionId
        }
      })
    },
    ...mapMutations({
      toggleSidebar: "anno/TOGGLE_SIDEBAR"
    }),
  },

}
</script>

<style scoped>
@media print {
  .pdf-document {
    position: static;
  }
}

#pdfContainer {
  min-width: 800px;
  max-width: 1000px;
}
</style>