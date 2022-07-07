<template>
  <div v-observe-visibility="{
      callback: visibilityChanged,
      throttle: 300,
      throttleOptions: {
        leading: 'visible',
      },
    }"
       class="pageContainer" :id="'page-container-' + pageNumber">
    <div class="canvasWrapper" :id="'canvas-wrapper-' + pageNumber">
      <canvas class="pdf-page" :id="'pdf-canvas-' + pageNumber"></canvas>
    </div>
    <div class="textLayer" :id="'text-layer-' + pageNumber">

    </div>
  </div>

</template>

<script>
export const PIXEL_RATIO = window.devicePixelRatio || 1;
export const VIEWPORT_RATIO = 0.98;
import * as pdfjsLib  from "pdfjs-dist/build/pdf.js"
import { ObserveVisibility } from 'vue3-observe-visibility'
import throttle from 'lodash/throttle';
import debounce from 'lodash.debounce';

export default {
  name: 'PDFPage',
  props: {
    scrollTop: {
      type: Number,
      default: 0
    },
    clientHeight: {
      type: Number,
      default: 0
    },
    pdf: {
      type: Object
    },
    pageNumber: {
      type: Number,
      default: 0,
    }
  },
  directives: {
    ObserveVisibility,
  },
  data() {
    return {
      renderTask: undefined,
      isVisible: false,
      resizeOb: undefined,
      isRendered: true
    };
  },
  methods: {
    visibilityChanged(isVisible, entry) {
      this.isVisible = isVisible;
      if (isVisible) {
        if (this.renderTask) return;
        this.render();
      }
      this.$emit('updateVisibility', {pageNumber: this.pageNumber, isVisible: isVisible});
    },
    resizeHandler(event) {
      // TODO its not the best solution to rerender everything, but it works
      // Optimization are for the future!
      if (this.renderTask && this.isRendered) {
        this.destroyRenderTask(true);
      }
    },
    render() {
      this.pdf.getPage(this.pageNumber).then((page) => {
          this.renderPage(page);
        });
    },
    renderPage(page) {
      if (this.renderTask) return;

      const container = document.getElementById('page-container-' + page.pageNumber);
      const wrapper = document.getElementById('canvas-wrapper-' + page.pageNumber);
      const canvas = document.getElementById('pdf-canvas-' + page.pageNumber);
      const context = canvas.getContext('2d');

      const scale = wrapper.getBoundingClientRect().width /
          page.getViewport({scale: 1.0}).width;

      const viewport = page.getViewport({scale: scale});
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      let renderContext = {
        canvasContext: context,
        viewport: viewport
      }

      this.renderTask = page.render(renderContext);

      this.renderTask.promise.then(() => {
        this.isRendered = true;
        return page.getTextContent();
      }).then((textContent) => {

        const canvas_offset = document.getElementById('pdf-canvas-' + page.pageNumber).getBoundingClientRect();
        const text_layer = document.getElementById('text-layer-'+ page.pageNumber);
        text_layer.style.height = canvas_offset.height + 'px';
        text_layer.style.width = canvas_offset.width + 'px';

        pdfjsLib.renderTextLayer({
          textContent: textContent,
          enhanceTextSelection: true,
          container: document.getElementById('text-layer-'+ page.pageNumber),
          viewport: viewport,
          textDivs: []
        })

      }).catch(response => {
        this.destroyRenderTask();
        console.log(`Failed to render page ${this.pageNumber}: ` + response);

      });
    },
    destroyPage(pageNumber) {
      // PDFPageProxy#_destroy
      // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
      this.$parent.$emit('destroy-page'); //TODO
      //if (pageNumber) page._destroy();
      this.destroyRenderTask();
    },
    destroyRenderTask(reinit = false) {
      if (!this.renderTask) return;
      // RenderTask#cancel
      // https://mozilla.github.io/pdf.js/api/draft/RenderTask.html
      this.renderTask.cancel();
      this.renderTask = undefined;
      const textContainer = document.getElementById('text-layer-'+ this.pageNumber);
      while(textContainer.firstChild) {
        textContainer.removeChild(textContainer.firstChild);
      }
      if (reinit) {
        this.render();
      }
    },
  },
  mounted() {
    this.resizeOb = new ResizeObserver(debounce(this.resizeHandler, 1000));
    this.resizeOb.observe(document.getElementById('canvas-wrapper-' + this.pageNumber));
  },
  beforeUnmount() {
    if (this.resizeOb) {
      this.resizeOb.disconnect();
    }
    this.destroyPage(this.pageNumber);
  },
};
</script>
<style>
.pageContainer {
  position:relative;
}
</style>