<template>
  <div id="pdfContainer" class="has-transparent-text-layer">
    <PDFPage
        v-for="page in pdf.pages"
        :key="page.pageNumber"
        :pageNumber="page.pageNumber"
        :pdf="pdf"
        class="scrolling-page"
        @destroyPage="destroyPage"
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
      type: String,
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
    }
  },
  watch: {
    "pdf.pageCount"() {
      this.pdf.fetchPages();
    },
    scrollTo() {
      if (this.scrollTo !== null) {
        this.scrollTo = null;
      }
    },
  },
  computed: {
    /*pagesLength() {
      return this.pdf.pages.length;
    },*/
  },
  sockets: {
    pdf: function (data) {
      const loadingTask = pdfjsLib.getDocument(data.file);
      loadingTask.promise
          .then((pdf) => {
            this.pdf.setPDF(pdf);
          })
          .catch(response => {
            console.log("Error loading PDF: " + response);
            this.$router.push("/index.html");
          });
    }
  },
  mounted() {
    this.$socket.emit("pdf_get", {document_id: this.document_id});
  },
  methods: {
    updateVisibility(page) {
      if (page.isVisible) {
        //TODO: also working to fetch further page on the fly, but can be optimized!
        this.pdf.fetchPages(page.pageNumber);
      }
    },
    /*fetchPages(currentPage) {
      this.pdf.fetchPages(currentPage);
    },*/
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