<template>
  <div v-if="!pdf">
    <BasicLoading  />
  </div>
  <div
    v-if="pdf"
    id="pdfContainer"
    class="has-transparent-text-layer"
  >
    <div class="zoom-controls">
      <button @click="zoomOut" title="Zoom Out">-</button>
      <button @click="resetZoom" title="Reset Zoom">Reset</button>
      <button @click="zoomIn" title="Zoom In">+</button>
      <span>{{ Math.round(scale * 100) }}%</span>
    </div>
    <PDFPage
      v-for="page in pdf.pageCount"
      :key="'PDFPageKey' + page"
      :page-number="page"
      :render="renderCheck[page - 1]"
      class="scrolling-page"
      :zoom-value="scale"
      @update-visibility="updateVisibility"
    />
    <Adder v-if="!readonly"/>
  </div>
</template>

<script>

import PDFPage from "./PDFPage.vue";
import {PDF} from './pdfStore.js';
//import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs"
// import * as pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs";
import {computed} from "vue";
import * as pdfjsLib from 'pdfjs-dist'
import Adder from "./Adder.vue";
import BasicLoading from "@/basic/Loading.vue";
await import("pdfjs-dist/build/pdf.worker.mjs");



//pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

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
  components: {BasicLoading, PDFPage, Adder},
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
      default: null,
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
      scale: 1.0,
      originalScale: null,
      DEFAULT_SCALE: 1.0,
      MIN_SCALE: 0.25,
      MAX_SCALE: 10.0,
      DEFAULT_SCALE_DELTA: 1.1,
      isZooming: false
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
  mounted() {
    this.originalScale = this.scale;
    this.$socket.emit("documentGet",
      {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId
      },
      (res) => {
        if (res.success) {
          const loadingTask = pdfjsLib.getDocument(res['data']['file']);
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
        } else {
          this.eventBus.emit('toast', {
            title: "PDF Loading Error",
            message: res.message,
            variant: "danger"
          });
          this.$router.push("/");
        }
      }
    );
  },
  unmounted() {
    this.pdf = null;
  },
  methods: {
    zoomIn() {
      if (this.isZooming) return;
      this.isZooming = true;
      let newScale = this.scale * this.DEFAULT_SCALE_DELTA;
      this.scale = Math.min(this.MAX_SCALE, Math.round(newScale * 10) / 10);
      setTimeout(() => {
        this.isZooming = false;
      }, 1000); // Match the debounce timeout
    },
    zoomOut() {
      if (this.isZooming) return;
      this.isZooming = true;
      let newScale = this.scale / this.DEFAULT_SCALE_DELTA;
      this.scale = Math.max(this.MIN_SCALE, Math.round(newScale * 10) / 10);
      setTimeout(() => {
        this.isZooming = false;
      }, 1000); // Match the debounce timeout
    },
    resetZoom() {
      if (this.isZooming) return;
      this.isZooming = true;
      this.scale = this.originalScale || this.DEFAULT_SCALE;
      setTimeout(() => {
        this.isZooming = false;
      }, 1000);
    },
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

.zoom-controls {
  position: sticky;
  top: 0;
  z-index: 100;
  background: white;
  padding: 8px;
  border-bottom: 1px solid #ddd;
  display: flex;
  gap: 8px;
  align-items: center;
}

.zoom-controls button {
  padding: 4px 8px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
}

.zoom-controls button:hover {
  background: #f5f5f5;
}
</style>
