<template>
  <div :id="'page-container-' + pageNumber"
       v-observe-visibility="{
      callback: visibilityChanged,
      throttle: 300,
      throttleOptions: {
        leading: 'visible',
      },
    }" class="pageContainer">
    <div :id="'canvas-wrapper-' + pageNumber" class="canvasWrapper">
      <canvas :id="'pdf-canvas-' + pageNumber" class="pdf-page"></canvas>
    </div>
    <div :id="'text-layer-' + pageNumber" class="textLayer">

    </div>
  </div>

</template>

<script>
/* PDFPage.vue - pdf page

This component holds a single pdf page and includes the rendering itself

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import * as pdfjsLib from "pdfjs-dist/build/pdf.js"
import {ObserveVisibility} from 'vue3-observe-visibility'
import debounce from 'lodash.debounce';

export default {
  name: 'PDFPage',
  props: {
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
      isRendered: false,
      scale: null,
    };
  },
  methods: {
    init() {
      this.pdf.getPage(this.pageNumber).then((page) => {
        const wrapper = document.getElementById('canvas-wrapper-' + page.pageNumber);
        const canvas = document.getElementById('pdf-canvas-' + page.pageNumber);

        this.scale = wrapper.getBoundingClientRect().width /
            page.getViewport({scale: 1.0}).width;

        const viewport = page.getViewport({scale: this.scale});
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (this.isVisible || !this.isVisible) {
          // stop rendering and wait for rerendering
          if (this.renderTask) {
            this.destroyRenderTask();
          }
          this.renderPage(page);
        }
      });
    },
    visibilityChanged(isVisible, entry) {
      this.isVisible = isVisible;
      if (this.isVisible && !this.isRendered) {
        this.init();
      }
      this.$emit('updateVisibility', {pageNumber: this.pageNumber, isVisible: isVisible});

      if (this.isVisible) {
        this.$socket.emit("stats", {action: "pageView", data: {pageNumber: this.pageNumber}});
      }
    },
    resizeHandler(event) {
      //if(this.isRendered) this.destroyPage();
      //this.init()
    },
    renderPage(page) {
      if (this.renderTask) return;

      const canvas = document.getElementById('pdf-canvas-' + page.pageNumber);
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({scale: this.scale});

      let renderContext = {
        canvasContext: context,
        viewport: viewport
      }

      this.renderTask = page.render(renderContext);

      this.renderTask.promise.then(() => {
        return page.getTextContent();
      }).then((textContent) => {

        const canvas_offset = document.getElementById('pdf-canvas-' + page.pageNumber).getBoundingClientRect();
        const text_layer = document.getElementById('text-layer-' + page.pageNumber);

        text_layer.style.height = canvas_offset.height + 'px';
        text_layer.style.width = canvas_offset.width + 'px';

        pdfjsLib.renderTextLayer({
          textContent: textContent,
          enhanceTextSelection: true,
          container: document.getElementById('text-layer-' + page.pageNumber),
          viewport: viewport,
          textDivs: []
        })

        this.isRendered = true;
        this.pdf.renderingDone.set(page.pageNumber, true);

      }).catch(response => {
        this.destroyRenderTask();
        console.log(`Failed to render page ${this.pageNumber}: ` + response);

      });
    },
    destroyPage() {
      // PDFPageProxy#_destroy
      // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
      this.$emit('destroyPage', {pageNumber: this.pageNumber});
      this.destroyRenderTask();
    },
    destroyRenderTask() {
      if (!this.renderTask) return;
      // RenderTask#cancel
      // https://mozilla.github.io/pdf.js/api/draft/RenderTask.html
      this.renderTask.cancel();
      this.isRendered = false;
      this.pdf.renderingDone.set(this.pageNumber, false);
      this.renderTask = undefined;
    },
  },
  mounted() {
    this.init()
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
  position: relative;
  border-bottom-style: solid;
}
</style>