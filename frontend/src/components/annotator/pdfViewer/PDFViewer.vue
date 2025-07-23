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
  <div class="pdf-toolbar">
      <button class="toolbar-btn" @click="zoomOut" title="Zoom Out">
        <LoadIcon icon-name="zoom-out" :size="18" />
      </button>
      <button class="toolbar-btn" @click="resetZoom" title="Reset Zoom">
        <LoadIcon icon-name="arrow-counterclockwise" :size="18" />
      </button>
      <button class="toolbar-btn" @click="zoomIn" title="Zoom In">
        <LoadIcon icon-name="zoom-in" :size="18" />
      </button>
      <span class="toolbar-label">{{ Math.round(scale * 100) }}%</span>
      <!-- Add more buttons here as needed -->
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
import * as pdfjsLib from "pdfjs-dist"

import {computed} from "vue";

import Adder from "./Adder.vue";
import LoadIcon from "@/basic/Icon.vue";
import BasicLoading from "@/basic/Loading.vue";
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
  components: {BasicLoading, PDFPage, Adder, LoadIcon},
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
  max-width: 1000px;
}

.pdf-toolbar {
  position: sticky;
  top: 0;
  z-index: 200;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  min-height: 38px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
}

.toolbar-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.toolbar-btn:hover{
  background: #e3e6ea;
}

.toolbar-label {
  font-size: 0.95em;
  color: #333;
  margin-left: 8px;
  margin-right: 8px;
  min-width: 40px;
  text-align: center;
}
</style>
