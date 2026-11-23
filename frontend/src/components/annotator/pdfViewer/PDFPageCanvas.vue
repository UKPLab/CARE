<template>
      <div
        :id="'canvas-wrapper-' + pageNumber + '-' + documentId"
        class="canvasWrapper"
      >
        <Loader
          :loading="!isRendered"
          :text="$t('annotator.pdfPage.loadingPage', { pageNumber })"
          class="pageLoader"
        />

        <canvas
          :id="'pdf-canvas-'+ pageNumber + '-' + documentId"
          :style="{'visibility':(isRendered)?'visible':'hidden'}"
          class="pdf-page"
        />
      </div>
      <div
        :id="'text-layer-' + pageNumber + '-' + documentId"
        class="textLayer"
      />
</template>

<script>
import * as pdfjsLib from 'pdfjs-dist';
import {toRaw} from 'vue';
import Loader from "@/basic/Loading.vue";
import "pdfjs-dist/web/pdf_viewer.css";

const SEARCH_TEXT_CURRENT_STYLE_ID = "pdf-search-text-current-style";
if (typeof document !== "undefined" && !document.getElementById(SEARCH_TEXT_CURRENT_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = SEARCH_TEXT_CURRENT_STYLE_ID;
  style.textContent = ".textLayer::search-text:current { color: transparent; background-color: rgba(255, 165, 0, 0.7); }";
  document.head.appendChild(style);
}


/** Paints and cancels one PDF page canvas and its searchable text layer. */
export default {
  name: 'PDFPageCanvas',
  components: {Loader},
  inject: {documentId: {type: Number, required: true}, pdf: {type: Object, required: true}},
  props: {
    pageNumber: {
      type: Number,
      default: 0,
    },
    zoomValue: {
      type: Number,
      default: 1.0,
    },
    containerWidth: {
      type: Number,
      required: true,
    },
    render: {
      type: Boolean,
      required: true
    }
  },
  emits: ['painted', 'clearing', 'cleared'],
  data() { return {renderTask: undefined, isRendered: false, scale: null, currentWidth: 0, originalWidth: 0, devicePixelRatio: window.devicePixelRatio || 1}; },
  watch: {
zoomValue() {
      this.refit();
    },
containerWidth() {
      this.resizeHandler();
    },
render() {
      this.init();
    }
  },
  mounted() { this.$nextTick(this.resizeHandler); },
  beforeUnmount() { this.destroyPage(); },
  methods: {
applyZoomToWrapper() {
      if (this.originalWidth <= 0) {
        return;
      }
      const wrapper = document.getElementById('canvas-wrapper-' + this.pageNumber + '-' + this.documentId);
      const pageContainer = document.getElementById('page-container-' + this.pageNumber + '-' + this.documentId);
      if (!wrapper || !pageContainer) {
        return;
      }
      const width = this.originalWidth * this.zoomValue;
      wrapper.style.width = width + 'px';
      wrapper.style.height = (width * 1.4142) + 'px';
      // The text layer clips to this box, so the page width has to match the canvas.
      pageContainer.style.width = width + 'px';
      this.currentWidth = width;
    },
init() {
      if (this.render && !this.isRendered) {
        this.applyZoomToWrapper();
        this.pdf.getPage(this.pageNumber).then((page) => {
          const wrapper = document.getElementById('canvas-wrapper-' + page.pageNumber + '-' + this.documentId);
          const canvas = document.getElementById('pdf-canvas-' + page.pageNumber + '-' + this.documentId);
          if (!wrapper || !canvas) {
            return;
          }

          // Calculate scale based on wrapper width
          this.scale = wrapper.getBoundingClientRect().width / page.getViewport({scale: 1.0}).width;

          const viewport = page.getViewport({scale: this.scale});
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (this.renderTask) {
            this.destroyRenderTask();
          }
          this.renderPage(page);
        });
      }
    },
refit() {
      this.applyZoomToWrapper();
      if (this.renderTask || this.isRendered) {
        this.destroyPage();
      }
      if (this.render) {
        this.init();
      }
    },
resizeHandler() {
      const available = this.containerWidth;
      if (available <= 0 || Math.abs(available - this.originalWidth) < 2) {
        return;
      }

      this.originalWidth = available;
      this.currentWidth = available;
      this.refit();
    },
renderPage(page) {
      if (this.renderTask) return;

      const canvas = document.getElementById('pdf-canvas-' + page.pageNumber + '-' + this.documentId);
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({scale: this.scale * this.devicePixelRatio});

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      let renderContext = {
        canvasContext: context,
        viewport: viewport
      }

      this.renderTask = page.render(renderContext);
      const rawRenderTask = toRaw(this.renderTask);
      // cancel() does nothing after resolve, so a replaced task must stop here.
      const stillCurrent = () => toRaw(this.renderTask) === rawRenderTask;

      rawRenderTask.promise.then(() => {
        if (!stillCurrent()) {
          return;
        }
        return page.getTextContent();
      }).then((textContent) => {
        if (!stillCurrent()) {
          return;
        }
        const textLayerDiv = document.getElementById('text-layer-' + page.pageNumber + '-' + this.documentId);

        // Use display scale for text layer positioning
        const displayViewport = page.getViewport({scale: this.scale});
        const { scale } = displayViewport;

        textLayerDiv.style.setProperty("--total-scale-factor", `${scale}`);
        textLayerDiv.style.setProperty("--scale-round-y", `${1}px`)
        textLayerDiv.style.setProperty("--scale-round-x", `${1}px`)

        const renderTask = new pdfjsLib.TextLayer({
          container: textLayerDiv,
          textContentSource: textContent,
          viewport: displayViewport.clone({ dontFlip: true })
        });

        return renderTask.render();
      }).then(() => {
          if (!stillCurrent()) {
            return;
          }
          this.pdf.renderingDone.set(page.pageNumber, true);
          this.isRendered = true;
          this.$emit('painted', this.scale);
      }).catch(response => {
        // A replaced paint must not clear the task that replaced it.
        if (!stillCurrent()) {
          return;
        }
        if (response instanceof pdfjsLib.RenderingCancelledException) {
          return;
        }
        this.destroyRenderTask();
        console.log(`Failed to render page ${this.pageNumber}: ` + response);
      });
    },
destroyRenderTask() {
      if (!this.renderTask) return;
      // RenderTask#cancel
      // https://mozilla.github.io/pdf.js/api/draft/RenderTask.html
      toRaw(this.renderTask).cancel();
      this.isRendered = false;
      this.pdf.renderingDone.set(this.pageNumber, false);
      this.renderTask = undefined;
      this.$emit('cleared');
    },
destroyPage() {
      this.$emit('clearing');


      const textLayer = document.getElementById('text-layer-' + this.pageNumber + '-' + this.documentId);
      if (textLayer) {
        while (textLayer.firstChild) {
          textLayer.removeChild(textLayer.firstChild);
        }
      }

      this.destroyRenderTask();
    }
  },
};
</script>

<style>
.pageLoader {
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%)
}

.canvasWrapper {
  position: relative;
  /* Same height before and after rendering, so the scroll height does not jump (A4 ratio) */
  aspect-ratio: 1 / 1.4142;
}

.pdf-page {
  width: 100%;
  height: auto;
}

/* The text layer is normally invisible (color: transparent) - it exists only
   so the browser has real text to search/select against, the visible glyphs
   come from the canvas underneath. Native find has to make a match legible,
   which reveals that invisible text rendered in a fallback font on top of the
   canvas's PDF-font glyphs, producing a doubled/ghosted look. ::search-text
   lets us suppress just the text color and paint our own plain highlighter-
   style box instead - declaring any property here opts out of Chrome's own
   default highlight paint entirely, so background-color must be set
   explicitly too, not left to fall back to the browser default.
   Chromium 144+ only; unsupported browsers silently keep today's behavior. */
.textLayer::search-text {
  color: transparent;
  background-color: rgba(255, 223, 0, 0.5);
}
</style>
