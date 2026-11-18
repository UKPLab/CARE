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
      <PDFPageCanvas
        ref="canvas"
        :page-number="pageNumber"
        :zoom-value="zoomValue"
        :container-width="containerWidth"
        :render="render"
        @painted="onPainted"
        @clearing="onPaintClearing"
        @cleared="remove_anchors"
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

import {ObserveVisibility} from 'vue3-observe-visibility'
import PDFPageCanvas from "./PDFPageCanvas.vue";
import Highlights from "./Highlights.vue";
// import { PDFFindController, EventBus } from "pdfjs-dist/web/pdf_viewer.mjs";


import {Anchoring} from "@/assets/pdfViewer/anchor.js";
import {getCollapsedAnnotationIds} from "@/assets/annotations";

// Lightning CSS (Vite's CSS minifier) rejects pseudo-classes after a pseudo-element
// other than user-action ones, so `::search-text:current` would break the build.
// Injected at runtime instead - see the ::search-text rule in the style block.

export default {
  name: 'PDFPage',
  subscribe: ["comment_state"],
  components: {PDFPageCanvas, Highlights},
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
  data() { return {isRendered: false, scale: null, anchor: null}; },
  computed: {
    annotations() {
      const allAnnotations = this.$store.getters['table/annotation/getFiltered'](e => e.documentId === this.documentId
        && e.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === this.pageNumber)
      return allAnnotations.filter(anno => !this.collapsedAnnotationIds.includes(anno.id));
    },
    collapsedAnnotationIds() {
      return getCollapsedAnnotationIds(this.$store, this.documentId);
    },
    anchors() {
      return [].concat(
        this.annotations.filter(a => a.anchors !== null)
          .flatMap(a => a.anchors)
          .filter(a => a !== undefined)
      )
    },
  },
  watch: {annotations() {
      if (this.isRendered) {
        this.add_anchors();
      }
    }},
  mounted() {
    // Annotations being positioned right now, so add_anchors never positions one twice
    this.pendingAnchors = new WeakSet();
    this.$nextTick(() => {
      this.anchor = new Anchoring(this.pdf, this.pageNumber, this.documentId);
    });
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
onPainted(scale) {
      this.scale = scale;
      this.isRendered = true;
      this.add_anchors();
    },
onPaintClearing() {
      this.$emit('destroyPage', {pageNumber: this.pageNumber});
      this.isRendered = false;
      this.$refs.highlights?.removeAllHighlights(document.getElementById('text-layer-' + this.pageNumber + '-' + this.documentId));
      this.remove_anchors();
    },
destroyPage() { this.$refs.canvas?.destroyPage(); }
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
</style>
