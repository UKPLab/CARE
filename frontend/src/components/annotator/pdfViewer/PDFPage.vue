<template>
  <div>
    <div
      :id="'page-container-' + pageNumber"
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
        :style="canvasStyle"
        :id="'placeholder-canvas-' + pageNumber"
      />
      <div
        :id="'canvas-wrapper-' + pageNumber"
        class="canvasWrapper"
      >
        <Loader
          :loading="!isRendered"
          :text="'Loading Page ' + pageNumber"
          class="pageLoader"
        />

        <canvas
          :id="'pdf-canvas-' + pageNumber"
          :style="{'visibility':(isRendered)?'visible':'hidden'}"
          class="pdf-page"
        />
      </div>
      <div
        :id="'text-layer-' + pageNumber"
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
import debounce from 'lodash.debounce';
import Highlights from "./Highlights.vue";
// import { PDFFindController, EventBus } from "pdfjs-dist/web/pdf_viewer.mjs";


import {Anchoring} from "@/assets/pdfViewer/anchor.js";
import Loader from "@/basic/Loading.vue";
import {toRaw} from 'vue';

export default {
  name: 'PDFPage',
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
    acceptStats: {
      default: () => false
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
    render: {
      type: Boolean,
      required: true
    }
  },
  emits: ["updateVisibility", "destroyPage"],
  data() {
    return {
      renderTask: undefined,
      resizeOb: undefined,
      isRendered: false,
      scale: null,
      currentWidth: 0,
      anchor: null,
      devicePixelRatio: window.devicePixelRatio || 1,
      isZooming: false
    };
  },
  computed: {
    annotations() {
      return this.$store.getters['table/annotation/getFiltered'](e => e.documentId === this.documentId
        && e.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === this.pageNumber);
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
    zoomValue: {
      handler(newValue, oldValue) {
        if (this.isRendered) {
          this.isZooming = true;
          const wrapper = document.getElementById('canvas-wrapper-' + this.pageNumber);
          
          // Calculate new width based on current width and zoom change
          const currentWidth = wrapper.getBoundingClientRect().width;
          const newWidth = (currentWidth / oldValue) * newValue;
          wrapper.style.width = newWidth + 'px';
          wrapper.style.height = (newWidth * 1.4142) + 'px';
          
          this.currentWidth = newWidth;
          
          // Force re-anchoring by nullifying existing anchors
          this.remove_anchors();
          
          this.destroyPage();
          this.init();
        }
      }
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
    this.setA4();
    this.anchor = new Anchoring(this.pdf, this.pageNumber);
    this.resizeOb = new ResizeObserver(debounce(this.resizeHandler, 1000));
    this.resizeOb.observe(document.getElementById('canvas-wrapper-' + this.pageNumber));

    this.init();
  },
  beforeUnmount() {
    if (this.resizeOb) {
      this.resizeOb.disconnect();
    }
    this.destroyPage();
  },
  unmounted() {
    this.remove_anchors();
  },
  methods: {
    visibilityChanged(isVisible, entry) {
      this.$emit('updateVisibility', {
        pageNumber: this.pageNumber,
        isVisible: isVisible,
        offset: document.getElementById('page-container-' + this.pageNumber).offsetTop - 52.5
      });
    },
    setA4() {
      const canvas = document.getElementById('placeholder-canvas-' + this.pageNumber);
      const wrapper = document.getElementById('canvas-wrapper-' + this.pageNumber);
      const width = wrapper.getBoundingClientRect().width;
      const height = width * 1.4142;
      canvas.height = height;
      canvas.width = width;
      this.currentWidth = width;
    },
    init() {
      if (this.render && !this.isRendered) {
        this.pdf.getPage(this.pageNumber).then((page) => {
          const wrapper = document.getElementById('canvas-wrapper-' + page.pageNumber);
          const canvas = document.getElementById('pdf-canvas-' + page.pageNumber);

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
    resizeHandler(event) {
      if (this.isZooming) return;
      
      const wrapper = document.getElementById('canvas-wrapper-' + this.pageNumber);
      const width = wrapper.getBoundingClientRect().width;
      
      if (width !== this.currentWidth) {
        this.currentWidth = width;
        this.destroyPage();
        this.init();
        if (this.acceptStats) {
          this.$socket.emit("stats", {
            action: "pdfPageResizeChange",
            data: {documentId: this.documentId, pageNumber: this.pageNumber, width: width}
          });
        }
      }
    },
    renderPage(page) {
      if (this.renderTask) return;

      const canvas = document.getElementById('pdf-canvas-' + page.pageNumber);
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({scale: this.scale * this.devicePixelRatio});

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      let renderContext = {
        canvasContext: context,
        viewport: viewport
      }

      this.renderTask = page.render(renderContext);

      toRaw(this.renderTask).promise.then(() => {
        return page.getTextContent();
      }).then((textContent) => {
        const canvas_offset = document.getElementById('pdf-canvas-' + page.pageNumber).getBoundingClientRect();

        const textLayerDiv = document.getElementById('text-layer-' + page.pageNumber);
 
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
          this.pdf.renderingDone.set(page.pageNumber, true);
          this.isRendered = true;
          this.add_anchors();
      }).catch(response => {
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
      this.annotations.filter(anno => anno.anchors == null).forEach(async anno => {
        // Pass the current scale to ensure correct positioning
        anno.anchors = await Promise.all(anno.selectors.target.map((data) => {
          return this.anchor.locateAnchor(data, this.scale);
        }));
      });
    },
    remove_anchors() {
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
        this.$refs.highlights.removeAllHighlights(document.getElementById('text-layer-' + this.pageNumber));
      }
      
      const textLayer = document.getElementById('text-layer-' + this.pageNumber);
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
  border-bottom-style: solid;
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

</style>
