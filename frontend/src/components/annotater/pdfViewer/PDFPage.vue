<template>
  <div>
  <div :id="'page-container-' + pageNumber"
       v-observe-visibility="{
      callback: visibilityChanged,
      throttle: 300,
      throttleOptions: {
        leading: 'visible',
      },
    }" class="pageContainer">
  <canvas v-show="!isRendered" :id="'placeholder-canvas-' + pageNumber"></canvas>
    <div :id="'canvas-wrapper-' + pageNumber" class="canvasWrapper">
      <Loader :loading="!isRendered" class="pageLoader" :text="'Loading Page ' + pageNumber"></Loader>

      <canvas :style="{'visibility':(isRendered)?'visible':'hidden'}" :id="'pdf-canvas-' + pageNumber"
              class="pdf-page"></canvas>
    </div>
    <div :id="'text-layer-' + pageNumber" class="textLayer"></div>
  </div>
  <Highlights :page_id="pageNumber" ref="highlights" :document_id="document_id"/>
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
import Highlights from "./Highlights.vue";

import {Anchoring} from "../../../assets/pdfViewer/anchor.js";
import Loader from "../../basic/Loader.vue";


export default {
  name: 'PDFPage',
  components: {Loader, Highlights},
  props: {
    pdf: {
      type: Object
    },
    pageNumber: {
      type: Number,
      default: 0,
    },
    document_id: {
      type: Number,
      required: true
    },
    render: {
      type: Boolean,
      required: true
    }
  },
  emits: ["updateVisibility", "destroyPage"],
  directives: {
    ObserveVisibility,
  },
  watch: {
    render() {
      this.init();
    },
    annotations(newVal, oldVal) {
      if (this.isRendered)
        this.add_anchors();
    },
    /*annotationTags(newVal, oldVal) {
      //handle only updated values
      if (this.pdf.pageCount > 0) {
        console.log(newVal);
        newVal.filter(vnew => oldVal.map(vold => vold.anno).includes(vnew.anno))
            .filter(vnew => {
              const prevTags = oldVal.find(vold => vold.anno === vnew.anno).tag;
              const newTags = vnew.tag;

              console.log(vnew);

              return (prevTags === null) !== (newTags === null) ||
                  (prevTags.sort().toString() !== newTags.sort().toString())
            })
            .map(vnew => vnew.anno)
            .map(this.handle_tagchange)
      }
    },*/
  },
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
  computed: {
    annotations() {
      return this.$store.getters['anno/getPageAnnotations'](this.document_id, this.pageNumber);
    },
    anchors() {
      return [].concat(this.$store.getters['anno/getAnchorsFlat'](this.document_id, this.pageNumber))
    },
  },
  methods: {
    visibilityChanged(isVisible, entry) {
      this.$emit('updateVisibility', {pageNumber: this.pageNumber, isVisible: isVisible});
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

          console.log(page);
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
        this.add_anchors();

        console.log("Rendering finished");
        console.log(this.annotations);


      }).catch(response => {
        this.destroyRenderTask();
        console.log(`Failed to render page ${this.pageNumber}: ` + response);

      });
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
    add_anchors() {
      console.log("add anchors")
      console.log(this.annotations);
      console.log(this.pageNumber);
      this.annotations.filter(anno => anno.anchors == null).forEach(async anno => {
        anno.anchors = await Promise.all(anno.selectors.target.map((data) => this.anchor.locateAnchor(data)));
      });
      console.log(this.annotations);
    },
    remove_anchors() {
      console.log("remove anchors")
      console.log(this.annotations);
      console.log(this.pageNumber);
      this.annotations.forEach(anno => anno.anchors = null);
    },
    _updateAnnotationLayerVisibility() {
      const selection = /** @type {Selection} */ (window.getSelection());
      // TODO CSS Style
      // Add CSS class to indicate whether there is a selection. Annotation
      // layers are then hidden by a CSS rule in `pdfjs-overrides.scss`.
      this.pdfViewer.viewer.classList.toggle(
          'is-selecting',
          !selection.isCollapsed
      );
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
      //this.$refs["highlights"].removeAllHighlights( document.getElementById('text-layer-' + this.pageNumber));

      this.remove_anchors();
      this.destroyRenderTask();
      //this.$refs["highlights"].removeAllHighlights( document.getElementById('text-layer-' + this.pageNumber));
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