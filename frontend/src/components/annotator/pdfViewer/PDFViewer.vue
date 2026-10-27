<template>
  <div v-if="!pdf">
    <BasicLoading  />
  </div>
  <div
    v-if="pdf"
    :id="'pdfContainer-' + documentId"
    ref="pdfContainerEl"
    class="has-transparent-text-layer"
    @copy="onCopy"
  >
    <!-- Toolbar -->
    <PDFToolbar
      :id="'pdfToolbar-' + documentId"
      v-model="toolbarVisible"
      :zoom-form-data="zoomFormData"
      :pdf-dark-mode="pdfDarkMode"
      @toggle-pdf-theme="togglePdfTheme"
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
      :class="['scrolling-page', { 'pdf-dark': pdfDarkMode }]"
      :container-width="containerWidth"
      :zoom-value="scale"
      @update-visibility="updateVisibility"
    />
    <Adder v-if="!readOnly && !componentReadOnly"/>
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
import { resolveApiMessage } from "@/assets/utils";
import debounce from "lodash.debounce";

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
    currentStudyStep: {
      type: Object,
      required: false,
      default: null
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    acceptStats: {
      default: () => false
    },
    hiddenStudyStepId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  provide() {
    return {
      pdf: computed(() => this.pdf),
      readOnly: computed(() => this.readOnly),
    }
  },
  emits: ['copy'],
  data() {
    return {
      pdf: null,
      observer: undefined,
      pdfContainer: null,
      containerWidth: 0,
      resizeDebounced: undefined,
      visiblePages: [1],
      lastVisibility: {},
      scale: 1.0,
      originalScale: null,
      DEFAULT_SCALE: 1.0,
      MIN_SCALE: 0.25,
      MAX_SCALE: 10.0,
      DEFAULT_SCALE_DELTA: 1.1,
      toolbarVisible: false,
      zoomFormData: {
        zoom: 1.0,
      },
      pdfDarkMode: localStorage.getItem("care.pdfDark") !== null
        ? localStorage.getItem("care.pdfDark") === "true"
        : document.documentElement.getAttribute("data-bs-theme") === "dark",
    }
  },
  computed: {
    appTheme() {
      return this.$store.getters["settings/getValue"]("app.theme.mode");
    },
    renderCheck() {
      let minPage = Math.max(Math.min(...this.visiblePages) - 3, 1);
      let maxPage = Math.min(Math.max(...this.visiblePages) + 3, this.pdf.pageCount);

      return [...Array(this.pdf.pageCount).keys()].map((page) => (page + 1 >= minPage && page + 1 <= maxPage));
    },
    isHidden() {
      return this.studyStepId !== null && this.studyStepId === this.hiddenStudyStepId;
    },
    componentReadOnly() {
      if(!this.readOnly) {
        return this.currentStudyStep?.configuration?.readOnlyComponents?.includes('annotator') || false;
      }
      return this.readOnly;
    },
  },
  watch: {
    appTheme(newVal, oldVal) {
      if (oldVal === undefined) return;
      this.pdfDarkMode = newVal === "dark";
      localStorage.removeItem("care.pdfDark");
    },
    scrollTo() {
      if (this.scrollTo !== null) {
        this.scrollTo = null;
      }
    },
    zoomFormData: {
      handler(newZoom) {
        if (this.scale !== newZoom.zoom) {
          this.scale = newZoom.zoom;
        }
      },
      deep: true,
    },
    isHidden(hidden) {
      // Hidden pages are not on screen, even though the browser still counts them as visible
      this.visiblePages.forEach((pageNumber) => {
        if (this.lastVisibility[pageNumber]) {
          this.sendVisibility({...this.lastVisibility[pageNumber], isVisible: !hidden});
        }
      });
    },
    scale(newScale) {
      // Keep form data in sync with scale
      if (this.zoomFormData.zoom !== newScale) {
        this.zoomFormData.zoom = newScale;
      }
    },
    pdf: {
      handler(value) {
        if (!value) {
          this.disconnectContainerObserver();
          this.containerWidth = 0;
          return;
        }
        this.watchContainer();
      },
      flush: "post",
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
          const loadingTask = pdfjsLib.getDocument({ data: res['data']['file'] });
          loadingTask.promise
            .then((pdf) => {
              this.pdf = new PDF();
              this.pdf.setPDF(pdf);
            })
            .catch(_response => {
              this.eventBus.emit('toast', {
                title: this.$t('errors.file.pdfLoadingError.title'),
                message: this.$t('errors.file.pdfLoadingError.message'),
                variant: "danger"
              });
              this.$router.push("/");
            });
        } else {
          this.eventBus.emit('toast', {
            title: this.$t('errors.file.pdfLoadingError.title'),
            message: resolveApiMessage(res),
            variant: "danger"
          });
          this.$router.push("/");
        }
      }
    );
  },
  unmounted() {
    this.disconnectContainerObserver();
    this.pdf = null;
  },
  methods: {
    /**
     * Watch the PDF column and publish its width.
     * Returns immediately when the column element is not in the page.
     * A later size change under 2 pixels, or a width of 0, is ignored.
     *
     * @returns {void}
     */
    watchContainer() {
      const el = this.$refs.pdfContainerEl;
      if (!el) {
        return;
      }
      this.disconnectContainerObserver();
      this.containerWidth = el.clientWidth;
      // One watch for the column. Pages read the width instead of searching for this div's id.
      this.resizeDebounced = debounce(() => {
        const node = this.$refs.pdfContainerEl;
        if (!node) {
          return;
        }
        const next = node.clientWidth;
        if (next <= 0 || Math.abs(next - this.containerWidth) < 2) {
          return;
        }
        this.containerWidth = next;
        if (this.acceptStats) {
          this.$socket.emit("stats", {
            action: "pdfPageResizeChange",
            data: {documentId: this.documentId, width: next}
          });
        }
      }, 200);
      this.observer = new ResizeObserver(this.resizeDebounced);
      this.observer.observe(el);
    },
    /**
     * Stop watching the PDF column and cancel a pending width update.
     * Does nothing when no watch is running.
     *
     * @returns {void}
     */
    disconnectContainerObserver() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = undefined;
      }
      if (this.resizeDebounced) {
        this.resizeDebounced.cancel();
        this.resizeDebounced = undefined;
      }
    },
    togglePdfTheme() {
      this.pdfDarkMode = !this.pdfDarkMode;
      localStorage.setItem("care.pdfDark", this.pdfDarkMode);
    },
    zoomIn() {
      let newScale = this.scale * this.DEFAULT_SCALE_DELTA;
      this.scale = Math.min(this.MAX_SCALE, Math.round(newScale * 10) / 10);
    },
    zoomOut() {
      let newScale = this.scale / this.DEFAULT_SCALE_DELTA;
      this.scale = Math.max(this.MIN_SCALE, Math.round(newScale * 10) / 10);
    },
    resetZoom() {
      this.scale = this.originalScale || this.DEFAULT_SCALE;
    },
    updateVisibility(page) {
      let stateChanged = false;
      if (page.isVisible) {
        if (!this.visiblePages.includes(page.pageNumber)) {
          this.visiblePages.push(page.pageNumber);
          stateChanged = true;
        }
      } else {
        if (this.visiblePages.includes(page.pageNumber)) {
          this.visiblePages.splice(this.visiblePages.indexOf(page.pageNumber), 1);
          stateChanged = true;
        }
      }
      this.lastVisibility[page.pageNumber] = page;
      if (stateChanged && !this.isHidden) {
        this.sendVisibility(page);
      }
    },
    sendVisibility(page) {
      if (!this.acceptStats) {
        return;
      }
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
