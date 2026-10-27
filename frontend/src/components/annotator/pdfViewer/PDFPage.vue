<template>
  <div>
    <div
      :id="'page-container-' + pageNumber + '-' + documentId"
      v-observe-visibility="{
        callback: visibilityChanged,
        throttle: 300,
        throttleOptions: {
          leading: 'visible',
        },
      }"
      class="pageContainer"
    >
      <canvas
        v-show="!isRendered"
        :id="'placeholder-canvas-' + pageNumber + '-' + documentId"
        :style="canvasStyle"
      />
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
    </div>
    <Highlights
      ref="highlights"
      :document-id="documentId"
      :page-id="pageNumber"
      :study-session-id="studySessionId"
    />
  </div>
</template>

<script>
/**
 *  Rendering a single pdf page
 *
 *  This component holds a single pdf page and includes the rendering itself
 *
 *  @author Dennis Zyska, Nils Dycke
 */

import * as pdfjsLib from 'pdfjs-dist'
import {ObserveVisibility} from 'vue3-observe-visibility'
import Highlights from "./Highlights.vue";
import "pdfjs-dist/web/pdf_viewer.css";
// import { PDFFindController, EventBus } from "pdfjs-dist/web/pdf_viewer.mjs";


import {Anchoring} from "@/assets/pdfViewer/anchor.js";
import Loader from "@/basic/Loading.vue";
import {toRaw} from 'vue';

// Lightning CSS (Vite's CSS minifier) rejects pseudo-classes after a pseudo-element
// other than user-action ones, so `::search-text:current` would break the build.
// Injected at runtime instead - see the ::search-text rule in the style block.
const SEARCH_TEXT_CURRENT_STYLE_ID = "pdf-search-text-current-style";
if (typeof document !== "undefined" && !document.getElementById(SEARCH_TEXT_CURRENT_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = SEARCH_TEXT_CURRENT_STYLE_ID;
  style.textContent = ".textLayer::search-text:current { color: transparent; background-color: rgba(255, 165, 0, 0.7); }";
  document.head.appendChild(style);
}

export default {
  name: 'PDFPage',
  subscribe: ["comment_state"],
  components: {Loader, Highlights},
  directives: {
    ObserveVisibility,
  },
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
    pdf: {
      type: Object,
      required: true,
    },
  },
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
  emits: ["updateVisibility", "destroyPage"],
  data() {
    return {
      renderTask: undefined,
      isRendered: false,
      scale: null,
      currentWidth: 0,
      originalWidth: 0,
      anchor: null,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  },
  computed: {
    annotations() {
      const allAnnotations = this.$store.getters['table/annotation/getFiltered'](e => e.documentId === this.documentId
        && e.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === this.pageNumber)
      return allAnnotations.filter(anno => !this.collapsedAnnotationIds.includes(anno.id));
    },
    collapsedCommentIds() {
      const commentIds = this.$store.getters['table/comment_state/getFiltered'](
        state => state.state === 1 &&
          state.documentId === this.documentId
      ).map(state => state.commentId);
      return commentIds;
    },
    collapsedAnnotationIds() {
      const annotationIds = this.$store.getters['table/comment/getFiltered'](
        comment => this.collapsedCommentIds.includes(comment.id)
      ).map(comment => comment.annotationId);
      return annotationIds;
    },
    anchors() {
      return [].concat(
        this.annotations.filter(a => a.anchors !== null)
          .flatMap(a => a.anchors)
          .filter(a => a !== undefined)
      )
    },
     canvasStyle() {
      return {
        transform: `scale(${1 / this.devicePixelRatio})`,
        transformOrigin: '0 0',
      };
    }
  },
  watch: {
    zoomValue() {
      this.refit();
    },
    containerWidth() {
      this.resizeHandler();
    },
    render() {
      this.init();
    },
    annotations() {
      if (this.isRendered) {
        this.add_anchors();
      }
    },
  },
  mounted() {
    // Annotations being positioned right now, so add_anchors never positions one twice
    this.pendingAnchors = new WeakSet();
    this.$nextTick(() => {
      this.anchor = new Anchoring(this.pdf, this.pageNumber, this.documentId);
      this.resizeHandler();
    });
  },
  beforeUnmount() {
    this.destroyPage();
  },
  unmounted() {
    this.remove_anchors();
  },
  methods: {
    visibilityChanged(isVisible, _entry) {
      this.$emit('updateVisibility', {
        pageNumber: this.pageNumber,
        isVisible: isVisible,
        offset: document.getElementById('page-container-' + this.pageNumber + '-' + this.documentId).offsetTop - 52.5
      });
    },
    setA4() {
      const width = this.containerWidth;
      if (width <= 0) {
        return;
      }
      const canvas = document.getElementById('placeholder-canvas-' + this.pageNumber + '-' + this.documentId);
      if (!canvas) {
        return;
      }
      this.originalWidth = width;
      const height = width * 1.4142;
      canvas.height = height;
      canvas.width = width;
      this.currentWidth = width;
    },
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
    /**
     * Size the page box for the current zoom, drop the current paint, and start another when this page should render.
     *
     * @returns {void}
     */
    refit() {
      this.applyZoomToWrapper();
      if (this.renderTask || this.isRendered) {
        this.destroyPage();
      }
      if (this.render) {
        this.init();
      }
    },
    /**
     * Store the new column width and refit the page.
     * Returns immediately when the width is missing or the change is under 2 pixels.
     *
     * @returns {void}
     */
    resizeHandler() {
      const available = this.containerWidth;
      if (available <= 0 || Math.abs(available - this.originalWidth) < 2) {
        return;
      }

      this.setA4();
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
          this.add_anchors();
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
      this.remove_anchors();
    },
    add_anchors() {
      const pending = this.pendingAnchors;
      this.annotations.filter(anno => anno.anchors == null && !pending.has(anno)).forEach(async anno => {
        pending.add(anno);
        try {
          // Pass the current scale to ensure correct positioning
          const anchors = await Promise.all(anno.selectors.target.map((data) => {
            return this.anchor.locateAnchor(data, this.scale);
          }));
          // Drop a result from before the page was re-rendered; the new render positions it again
          if (pending === this.pendingAnchors && anno.anchors == null) {
            anno.anchors = anchors;
          }
        } finally {
          pending.delete(anno);
        }
      });
    },
    remove_anchors() {
      // A new tracker marks results still in progress as outdated
      this.pendingAnchors = new WeakSet();
      this.annotations.forEach(anno => anno.anchors = null);
    },
    update_highlights(anchors) {
      // skip un-anchored annotations
      if (anchors === null || anchors === undefined || anchors.length === 0) {
        return;
      }

      // redraw highlights
      this.$refs["highlights"].update_highlights(anchors);
    },
    destroyPage() {
      this.$emit('destroyPage', {pageNumber: this.pageNumber});
      
      if (this.$refs.highlights) {
        this.$refs.highlights.removeAllHighlights(document.getElementById('text-layer-' + this.pageNumber + '-' + this.documentId));
      }
      
      const textLayer = document.getElementById('text-layer-' + this.pageNumber + '-' + this.documentId);
      if (textLayer) {
        while (textLayer.firstChild) {
          textLayer.removeChild(textLayer.firstChild);
        }
      }
      
      this.destroyRenderTask();
    },
  }
  ,

}
;
</script>
<style>
.pageContainer {
  position: relative;
  border-bottom: 1px solid var(--bs-border-color);
}

.pageLoader {
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%)
}

.canvasWrapper {
  position: relative;
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
