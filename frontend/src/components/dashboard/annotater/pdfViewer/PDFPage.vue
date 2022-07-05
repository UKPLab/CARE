<template>
  <div class="canvasWrapper">
    <canvas class="pdf-page" :id="'pdf-canvas-' + pageNumber"></canvas>
  </div>
  <div class="text-layer" :id="'text-layer-' + pageNumber">

  </div>
</template>

<script>
import debug from 'debug';
const log = debug('app:components/PDFPage');
export const PIXEL_RATIO = window.devicePixelRatio || 1;
export const VIEWPORT_RATIO = 0.98;
import * as pdfjsLib  from "pdfjs-dist/build/pdf.js"

export default {
  name: 'PDFPage',
  props: {
    scale: {
      type: Number,
      required: true,
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
      elementTop: 0,
      elementHeight: 0,
    };
  },
  computed: {
    /*actualSizeViewport() {
      return this.viewport.clone({scale: this.scale});
    },
    canvasStyle() {
      const {width: actualSizeWidth, height: actualSizeHeight} = this.actualSizeViewport;
      const [pixelWidth, pixelHeight] = [actualSizeWidth, actualSizeHeight]
        .map(dim => Math.ceil(dim / PIXEL_RATIO));
      return `width: ${pixelWidth}px; height: ${pixelHeight}px;`;
    },
    canvasAttrs() {
      let {width, height} = this.viewport;
      [width, height] = [width, height].map(dim => Math.ceil(dim));
      const style = this.canvasStyle;
      return {
        width,
        height,
        style,
        class: 'pdf-page box-shadow',
      };
    },
    pageNumber() {
      return this.page.pageNumber;
    },
    isElementVisible() {
      const {elementTop, elementBottom, scrollTop, scrollBottom} = this;
      if (!elementBottom) return;
      return elementTop < scrollBottom && elementBottom > scrollTop;
    },
    elementBottom() {
      return this.elementTop + this.elementHeight;
    },
    scrollBottom() {
      return this.scrollTop + this.clientHeight;
    },*/
  },
  methods: {
    updateElementBounds() {
      const {offsetTop, offsetHeight} = this.$el;
      this.elementTop = offsetTop;
      this.elementHeight = offsetHeight;
    },
    drawPage() {
      if (this.renderTask) return;
      const {viewport} = this;
      const canvasContext = this.$el.getContext('2d');
      const renderContext = {canvasContext, viewport};
      // PDFPageProxy#render
      // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
      this.renderTask = this.page.render(renderContext);
      this.renderTask
        .then(() => {
          this.$emit('page-rendered', {
            page: this.page,
            text: `Rendered page ${this.pageNumber}`,
          });
         })
        .catch(response => {
          this.destroyRenderTask();
          this.$emit('page-errored', {
            response,
            page: this.page,
            text: `Failed to render page ${this.pageNumber}`,
          });
        });
    },
    destroyPage(page) {
      // PDFPageProxy#_destroy
      // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
      if (page) page._destroy();
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
  watch: {
    scale: 'updateElementBounds',
    scrollTop: 'updateElementBounds',
    clientHeight: 'updateElementBounds',
    page(_newPage, oldPage) {
      this.destroyPage(oldPage);
    },
    isElementVisible(isElementVisible) {
      if (isElementVisible) this.drawPage();
    },
  },
  created() {
    // PDFPageProxy#getViewport
    // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
    //this.viewport = this.page.getViewport(this.scale);
  },
  mounted() {
    this.pdf.getPage(this.pageNumber).then((page) => {
        const canvas = document.getElementById('pdf-canvas-' + page.pageNumber);
        const canvas_ctx = canvas.getContext('2d');

        const viewport = page.getViewport(canvas.width / page.getViewport({scale: VIEWPORT_RATIO, rotation: 0, dontFlip:true}).width);
        canvas.style.height = viewport.height;

        let renderContext = {
          canvasContext: canvas_ctx,
          viewport: viewport
        }

        page.render(renderContext).promise.then(() => {
          return page.getTextContent();
        }).then((textContent) => {
          console.log(textContent);

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


    })
    });




    //log(`Page ${this.pageNumber} mounted`);
    //this.updateElementBounds();
  },
  beforeDestroy() {
    this.destroyPage(this.page);
  },
};
</script>
<style>
.pdf-page {
  display: block;
  margin: 0 auto;
  width:100%;
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