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
    <div 
      ref="toolbar"
      class="pdf-toolbar" 
      :class="{ 'collapsed': !toolbarVisible }"
    >  
      <template v-if="toolbarVisible">       
        <TopBarButton
          title="Reset"
          text="Reset"
          @click="resetZoom"
        />      
        <TopBarButton
          icon="plus-lg"
          @click="zoomIn"
        />
        <TopBarButton
          icon="dash-lg"
          @click="zoomOut"
        />      
        <!-- Zoom Percentage Form -->
        <div class="zoom-form-wrapper">
          <BasicForm
            v-model="zoomFormData"
            :fields="zoomFields"
          />
        </div>
      </template>

      <!-- Toggle Button (always visible) -->
      <button 
        class="toolbar-toggle-btn" 
        @click="toolbarVisible = !toolbarVisible" 
        :title="toolbarVisible ? 'Minimize Toolbar' : 'Show Toolbar'"
      >
        <LoadIcon :icon-name="toolbarVisible ? 'chevron-right' : 'tools'" :size="20" />
      </button>
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
    <Adder v-if="!readOnly"/>
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
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import BasicForm from "@/basic/Form.vue";
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
  components: {BasicLoading, PDFPage, Adder, LoadIcon, TopBarButton, BasicForm},
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
      zoomFields: [
        {
          key: "zoom",
          label: "Zoom",
          type: "select",
          options: [
            { value: 0.8, name: "80%" },
            { value: 0.9, name: "90%" },
            { value: 1.0, name: "100%" },
            { value: 1.1, name: "110%" },
            { value: 1.2, name: "120%" },
            { value: 1.3, name: "130%" },
            { value: 1.4, name: "140%" },
          ],
        },
      ],
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

.pdf-toolbar {
  position: sticky;
  top: 0;
  z-index: 200;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  min-height: 48px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  justify-content: flex-end;
}

.pdf-toolbar.collapsed {
  width: 64px;
  padding: 8px;
  justify-content: center;
  margin-left: auto;
}

.pdf-toolbar :deep(.btn) {
  transition: all 0.2s ease;
}

.pdf-toolbar :deep(.btn:hover) {
  background-color: #e9ecef;
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.toolbar-toggle-btn {
  margin-left: auto;
  background: none;
  border: none;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6c757d;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 32px;
  min-height: 32px;
}

.toolbar-toggle-btn:hover {
  background: #e9ecef;
  transform: scale(1.1);
}

.pdf-toolbar.collapsed .toolbar-toggle-btn {
  margin-left: 0;
  color: #6c757d;
}

.pdf-toolbar.collapsed .toolbar-toggle-btn:hover {
  color: #6c757d;
}

.zoom-form-wrapper {
  min-width: 100px;
}

.zoom-form-wrapper :deep(.form-label) {
  display: none;
}

.zoom-form-wrapper :deep(.form-select) {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 0.95em;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.zoom-form-wrapper :deep(.form-select:hover) {
  border-color: #007bff;
}

.zoom-form-wrapper :deep(.form-select:focus) {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
}
</style>
