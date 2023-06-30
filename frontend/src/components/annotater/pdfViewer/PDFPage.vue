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

import * as pdfjsLib from "pdfjs-dist/build/pdf.js"
import {ObserveVisibility} from 'vue3-observe-visibility'
import debounce from 'lodash.debounce';
import Highlights from "./Highlights.vue";

import {Anchoring} from "@/assets/pdfViewer/anchor.js";
import Loader from "@/basic/Loader.vue";
import {toRaw} from 'vue';

export default {
  name: 'PDFPage',
  components: {Loader, Highlights},
  directives: {
    ObserveVisibility,
  },
  inject: {
    documentId: {
      type: String,
      required: true,
    },
    studySessionId: {
      type: String,
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
      anchor: null
    };
  },
  computed: {
    annotations() {
      return this.$store.getters['anno/getPageAnnotations'](this.documentId, this.pageNumber);
    },
    anchors() {
      return [].concat(this.$store.getters['anno/getAnchorsFlat'](this.documentId, this.pageNumber))
    },
  },
  watch: {
    render() {
      this.init();
    },
    annotations() {
      if (this.isRendered)
        this.add_anchors();
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

          this.scale = wrapper.getBoundingClientRect().width /
            page.getViewport({scale: 1.0}).width;

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
      const wrapper = document.getElementById('canvas-wrapper-' + this.pageNumber);
      const width = wrapper.getBoundingClientRect().width;
      if (width !== this.currentWidth) {
        if (this.isRendered) this.destroyPage();
        this.currentWidth = width;
        this.init()
        this.$socket.emit("stats", {
          action: "pdfPageResizeChange",
          data: {documentId: this.documentId, pageNumber: this.pageNumber, width: width}
        })
      }
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

      toRaw(this.renderTask).promise.then(() => {
        return page.getTextContent();
      }).then((textContent) => {

        const canvas_offset = document.getElementById('pdf-canvas-' + page.pageNumber).getBoundingClientRect();
        const text_layer = document.getElementById('text-layer-' + page.pageNumber);

        text_layer.style.height = canvas_offset.height + 'px';
        text_layer.style.width = canvas_offset.width + 'px';

        pdfjsLib.renderTextLayer({
          textContent: textContent,
          textLayerMode: 2,
          container: document.getElementById('text-layer-' + page.pageNumber),
          viewport: viewport,
          textDivs: []
        })

        this.pdf.renderingDone.set(page.pageNumber, true);
        this.add_anchors();

        this.isRendered = true;


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
        anno.anchors = await Promise.all(anno.selectors.target.map((data) => this.anchor.locateAnchor(data)));
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
      // PDFPageProxy#_destroy
      // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
      this.$emit('destroyPage', {pageNumber: this.pageNumber});
      this.$refs["highlights"].removeAllHighlights(document.getElementById('text-layer-' + this.pageNumber));

      // delete previous contents from text layer
      const text_layer = document.getElementById('text-layer-' + this.pageNumber);
      while (text_layer.firstChild) {
        text_layer.removeChild(text_layer.firstChild);
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
</style>