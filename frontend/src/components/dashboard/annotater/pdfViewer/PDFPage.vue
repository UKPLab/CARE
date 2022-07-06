<template>
  <div class="pageContainer" :id="'page-container-' + pageNumber">
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


export default {
  name: 'PDFPage',
  props: {
    scale: {
      type: Number,
      required: false,
      default: 1.0
    },
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
  data() {
    return {
      renderTask: undefined,
    };
  },
  methods: {
    renderPage(page) {
      if (this.renderTask) return;

      const container = document.getElementById('page-container-' + page.pageNumber);
      const wrapper = document.getElementById('canvas-wrapper-' + page.pageNumber);
      const canvas = document.getElementById('pdf-canvas-' + page.pageNumber);
      const context = canvas.getContext('2d');

      /*
      const viewport = page.getViewport({scale: this.scale});
      const {width: actualSizeWidth, height: actualSizeHeight} = viewport;
      const [pixelWidth, pixelHeight] = [actualSizeWidth, actualSizeHeight]
        .map(dim => Math.ceil(dim / PIXEL_RATIO));
      canvas.style.width = `${pixelWidth}px`;
      canvas.style.height = `${pixelHeight}px`;
      console.log(pixelWidth);
      console.log("PIXEL RATIO" + PIXEL_RATIO);
      */

      /*
          const new_scale = wrapper.getBoundingClientRect().width /
          page.getViewport({scale: VIEWPORT_RATIO}).width;


      const [pixelWidth, pixelHeight] = [actualSizeWidth, actualSizeHeight]
        .map(dim => Math.ceil(dim / PIXEL_RATIO));
      canvas.style.width = `${pixelWidth}px`;
      canvas.style.height = `${pixelHeight}px`;
      */

      const scales = { 1: 3.2, 2: 4};
      const defaultScale = 4;
      const scale = scales[window.devicePixelRatio] || defaultScale;
      const new_scale = wrapper.getBoundingClientRect().width /
          page.getViewport({scale: scale}).width;

      const viewport = page.getViewport({scale: scale});
      canvas.height = viewport.height;
      canvas.width = viewport.width;


      const pageWidthScale = container.clientWidth / page.view[2];
      const pageHeightScale = container.clientHeight / page.view[3];
      const displayWidth = Math.min(pageWidthScale, pageHeightScale);

      canvas.style.width = `${(viewport.width * displayWidth) / scale}px`;
      canvas.style.height = `${(viewport.height * displayWidth) / scale}px`;

      /*


      //const viewport = page.getViewport({scale: new_ratio, rotation: 0, dontFlip: false});
      console.log(page);
      const viewport = page.getViewport({scale:0.5})
        canvas.style.height = viewport.height;
        console.log(viewport);

       */
        let renderContext = {
          canvasContext: context,
          viewport: viewport
        }

        this.renderTask = page.render(renderContext);

        this.renderTask.promise.then(() => {
          return page.getTextContent();
        }).then((textContent) => {
          const canvas_offset = document.getElementById('pdf-canvas-' + page.pageNumber).getBoundingClientRect();
          const text_layer = document.getElementById('text-layer-'+ page.pageNumber);
          text_layer.style.left = canvas_offset.left + 'px';
          text_layer.style.top = canvas_offset.top + 'px';
          text_layer.style.height = canvas_offset.height + 'px';
          text_layer.style.width = canvas_offset.width + 'px';


          pdfjsLib.renderTextLayer({
            textContent: textContent,
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

      //if (pageNumber) page._destroy();
      this.destroyRenderTask();
    },
    destroyRenderTask() {
      if (!this.renderTask) return;
      // RenderTask#cancel
      // https://mozilla.github.io/pdf.js/api/draft/RenderTask.html
      this.renderTask.cancel();
      delete this.renderTask;
    },
  },
  created() {
    // PDFPageProxy#getViewport
    // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
    //this.viewport = this.page.getViewport(this.scale);
  },
  mounted() {
    this.pdf.getPage(this.pageNumber).then((page) => {
      this.renderPage(page);
    });


          /*
*/






    //log(`Page ${this.pageNumber} mounted`);
    //this.updateElementBounds();
  },
  beforeDestroy() {
    this.destroyPage(this.pageNumber);
  },
};
</script>
<style>
.pageContainer {
  position:relative;
}
.canvasWrapper > canvas {
  width: 100%;
  margin: 0 auto;
}
.text-layer {
   position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    opacity: 0.2;
    line-height: 1.0;
}

.text-layer > div {
    color: transparent;
    position: absolute;
    white-space: pre;
    cursor: text;
    transform-origin: 0% 0%;
}


</style>