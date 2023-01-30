<template>
  <div id="pdfContainer" class="has-transparent-text-layer">
    <PDFPage
        v-for="page in pdf.pageCount"
        :key="'PDFPageKey' + page"
        :pageNumber="page"
        :pdf="pdf"
        :render="renderCheck[page - 1]"
        :document_id="document_id"
        class="scrolling-page"
        @updateVisibility="updateVisibility"
    />
    <Adder v-if="!readonly" :document_id="document_id" :pdf="pdf"></Adder>
  </div>
</template>

<script>
/* PDFViewer.vue - PDF

This component holds the PDF Pages and the all interacting vue components.
Central PDF View component.

Author: Dennis Zyska (zyska@ukp...)
*/
import PDFPage from "./PDFPage.vue";
import {PDF} from './pdfStore.js';
import * as pdfjsLib from "pdfjs-dist/build/pdf.js"
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";

import Adder from "./Adder.vue";
import {mapMutations} from "vuex";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default {
  name: "PDFViewer",
  components: {PDFPage, Adder},
  props: {
    document_id: {
      type: Number,
      required: true
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
  watch: {
    scrollTo() {
      if (this.scrollTo !== null) {
        this.scrollTo = null;
      }
    },
  },
  computed: {
    renderCheck() {
      let minPage = Math.max(Math.min(...this.visiblePages) - 3, 1);
      let maxPage = Math.min(Math.max(...this.visiblePages) + 3, this.pdf.pageCount);

      return [...Array(this.pdf.pageCount).keys()].map((page) => (page + 1 >= minPage && page + 1 <= maxPage));
    },
  },
  sockets: {
    documentFile: function (data) {
      console.log(data);
      if (data.document.id === this.document_id) {
        const loadingTask = pdfjsLib.getDocument(data.file);
        loadingTask.promise
            .then((pdf) => {
              this.pdf.setPDF(pdf);
            })
            .catch(response => {
              console.log("Error loading PDF: " + response);
              this.eventBus.emit('toast', {
                title: "PDF Loading Error",
                message: "Error during loading of the PDF file. Make sure the file is not corrupted and in valid PDF format.",
                variant: "danger"
              });

              this.$router.push("/index.html");
            });
      }
    }
  },
  mounted() {
    this.$socket.emit("documentGet", {documentId: this.document_id});

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
        data: {document_id: this.document_id, readonly: this.readonly, "visibility": page}
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