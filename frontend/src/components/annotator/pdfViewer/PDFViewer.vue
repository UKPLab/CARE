<template>
  <div v-if="!pdf">
    <BasicLoading  />
  </div>
  <div
    v-if="pdf"
    id="pdfContainer"
    class="has-transparent-text-layer"
    @copy="onCopy"
  >
    <!-- Toolbar -->
    <PDFToolbar
      v-model="toolbarVisible"
      :zoom-form-data="zoomFormData"
      :is-zooming="isZooming"
      @update:zoom-form-data="zoomFormData = $event"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @reset="resetZoom"
    />

    <PDFPage
      v-for="page in pdf.pageCount"
      :key="'PDFPageKey' + page"
      :page-number="page"
      :render="renderCheck[page - 1]"
      class="scrolling-page"
      :zoom-value="scale"
      @update-visibility="updateVisibility"
    />
    <Adder v-if="!readOnly"/>
  </div>
</template>

<script>

import PDFPage from "./PDFPage.vue";
import {PDF} from './pdfStore.js';
import * as pdfjsLib from "pdfjs-dist"

import {computed} from "vue";

import Adder from "./Adder.vue";
import BasicLoading from "@/basic/Loading.vue";
import PDFToolbar from "./PDFToolbar.vue";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

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
  components: {BasicLoading, PDFPage, Adder, PDFToolbar},
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
    readOnly: {
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
  emits: ['copy'],
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
      isZooming: false,
      toolbarVisible: false,
      zoomFormData: {
        zoom: 1.0,
      },
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
    zoomFormData: {
      handler(newZoom) {
        if (!this.isZooming) {
          this.isZooming = true;
          this.scale = newZoom.zoom;
          setTimeout(() => {
            this.isZooming = false;
          }, 1000);
        }
      },
      deep: true,
    },
    scale(newScale) {
      // Keep form data in sync with scale
      if (this.zoomFormData.zoom !== newScale) {
        this.zoomFormData.zoom = newScale;
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
            readOnly: this.readOnly,
            visibility: page,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
          }
        })
      }
    },
    onCopy(event) {
      this.$emit('copy', event);
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
  /* TODO: Would you prefer max-width here? */
}
</style>
