<template>
  <div
    v-if="pdf"
    id="pdfContainer"
    class="has-transparent-text-layer"
  >
    <PDFPage
      v-for="page in pdf.pageCount"
      :key="'PDFPageKey' + page"
      :page-number="page"
      :render="renderCheck[page - 1]"
      class="scrolling-page"
      @update-visibility="updateVisibility"
    />
    <Adder v-if="!readonly"/>
  </div>
</template>

<script>

import PDFPage from "./PDFPage.vue";
import {PDF} from './pdfStore.js';
import * as pdfjsLib from "pdfjs-dist/build/pdf.js"
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";
import {computed} from "vue";

import Adder from "./Adder.vue";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * PDF Viewer
 *
 * This component holds the PDF Pages and the all interacting vue components.
 * Central PDF View component.
 *
 * @author Dennis Zyska
 */
export default {
  name: "PDFViewer",
  components: {PDFPage, Adder},
  inject: {
    documentId: {
      type: Number,
      required: true,
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
    studyStepId: {
      type: Number,
      required: false,
      default: 0,
    },
    readonly: {
      type: Boolean,
      required: false,
      default: false,
    },
    acceptStats: {
      default: () => false
    },
  },
  provide() {
    return {
      pdf: computed(() => this.pdf),
    }
  },
  data() {
    return {
      pdf: null,
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
            this.pdf = new PDF();
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
    // TODO: add ssid
    this.$socket.emit("documentGet", {documentId: this.documentId, studySessionId: this.studySessionId, studyStepId: this.studyStepId});
  },
  unmounted() {
    this.pdf = null;
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
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "pdfPageVisibilityChange",
          data: {
            documentId: this.documentId,
            readonly: this.readonly,
            visibility: page,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
          }
        })
      }
    },
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