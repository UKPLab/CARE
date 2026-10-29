<template>
  <div class="scroll-markers-anchor">
    <div ref="track" class="scroll-markers">
      <div
        v-for="marker in markers"
        :key="marker.id"
        class="scroll-marker"
        :style="{top: marker.top + 'px', '--marker-color': marker.color}"
        @click="jumpTo(marker.id)"
        @mouseenter="hoveredId = marker.id"
        @mouseleave="hoveredId = null"
      />
      <div
        v-if="preview"
        class="scroll-marker-preview card shadow-sm small"
        :style="preview.style"
      >
        <div class="card-body p-2">
          <b v-if="preview.tagName">{{ preview.tagName }}:</b> {{ preview.text }}
          <div v-if="preview.commentText" class="text-body-secondary mt-1">
            {{ preview.commentCreator }}: {{ preview.commentText }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import debounce from "lodash.debounce";
import {isInPlaceholder} from "@/assets/anchoring/placeholder";
import {
  getAnnotationPreview,
  getCollapsedAnnotationIds,
  getSessionScope,
  getTagColor,
  isInSessionScope,
  spreadPositions,
} from "@/assets/annotations";

// Height of the visible marker line and the smallest distance between two markers, in px
const MARKER_HEIGHT = 3;
const MARKER_GAP = MARKER_HEIGHT + 2;

/**
 * Annotation markers on the viewer scrollbar
 *
 * Shows one line per visible annotation next to the scrollbar of the PDF viewer container,
 * like the change markers in an IDE. Clicking a marker scrolls to the annotation.
 * Must be placed directly after the viewer container (#viewerContainer-<documentId>).
 *
 * @author Mélissa Loew
 */
export default {
  name: "AnnotationScrollMarkers",
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
    showAllDocumentAnnotations: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  props: {
    /** PDF store of the viewer (pdfStore.js), null until the file is loaded */
    pdf: {
      type: Object,
      required: false,
      default: null,
    },
  },
  data() {
    return {
      markers: [],
      hoveredId: null,
      trackHeight: 0,
    };
  },
  computed: {
    annotations() {
      const scope = getSessionScope(this.$store, {
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        showAllDocumentAnnotations: this.showAllDocumentAnnotations,
      });
      const collapsedIds = getCollapsedAnnotationIds(this.$store, this.documentId);
      return this.$store.getters["table/annotation/getByKey"]("documentId", this.documentId)
        .filter(anno => isInSessionScope(anno, scope) && !collapsedIds.includes(anno.id));
    },
    /** Texts and position of the hover preview, opening downwards in the upper half of the track, upwards otherwise */
    preview() {
      const marker = this.markers.find(marker => marker.id === this.hoveredId);
      const annotation = marker && this.annotations.find(anno => anno.id === marker.id);
      if (!annotation) {
        return null;
      }
      const style = marker.top < this.trackHeight / 2
        ? {top: marker.top + "px"}
        : {bottom: (this.trackHeight - marker.top - MARKER_HEIGHT) + "px"};
      return {...getAnnotationPreview(this.$store, annotation), style};
    },
  },
  watch: {
    annotations() {
      this.updateMarkers();
    },
    pdf() {
      this.textTops.clear();
      this.updateMarkers();
    },
  },
  created() {
    // Estimated position of annotations on not yet rendered pages, by annotation id
    this.textTops = new Map();
    this.updateMarkers = debounce(this.computeMarkers, 200);
  },
  mounted() {
    this.container = document.getElementById("viewerContainer-" + this.documentId);
    if (!this.container) {
      return;
    }
    // Page heights change when pages render or the zoom changes, so watch the PDF content size too.
    // The PDF content is only inserted once the file has loaded, hence the MutationObserver.
    this.resizeObserver = new ResizeObserver(this.updateMarkers);
    this.resizeObserver.observe(this.container);
    this.childObserver = new MutationObserver(this.observeContent);
    this.childObserver.observe(this.container, {childList: true});
    this.observeContent();
    // Highlights only get their exact position once their page is rendered, which happens on scroll
    this.container.addEventListener("scroll", this.updateMarkers);
    this.updateMarkers();
  },
  beforeUnmount() {
    this.updateMarkers.cancel();
    if (this.container) {
      this.resizeObserver.disconnect();
      this.childObserver.disconnect();
      this.container.removeEventListener("scroll", this.updateMarkers);
    }
  },
  methods: {
    /** Watches every child of the viewer container for size changes, since the PDF content is inserted after load. */
    observeContent() {
      Array.from(this.container.children).forEach(child => this.resizeObserver.observe(child));
    },
    /** Recomputes the scaled marker positions on the track from the current highlight/page positions. */
    async computeMarkers() {
      const container = this.container;
      if (!container || container.scrollHeight === 0) {
        this.markers = [];
        return;
      }
      await this.loadTextTops();
      const pages = container.querySelectorAll(".scrolling-page");
      const contentTop = container.getBoundingClientRect().top - container.scrollTop;

      const trackHeight = this.$refs.track.clientHeight;
      this.trackHeight = trackHeight;
      const markers = this.annotations.map(anno => {
        const top = this.getPosition(anno, pages);
        if (top === null) {
          return null;
        }
        const color = getTagColor(this.$store, anno.tagId);
        return {
          id: anno.id,
          top: (top - contentTop) / container.scrollHeight * trackHeight,
          color: color ? "#" + color : null,
        };
      }).filter(marker => marker !== null).sort((a, b) => a.top - b.top);

      const tops = spreadPositions(markers.map(marker => marker.top), MARKER_GAP, trackHeight - MARKER_HEIGHT);
      this.markers = markers.map((marker, i) => ({...marker, top: tops[i]}));
    },
    /**
     * Estimates the position of annotations from the PDF text layout, for pages that are not rendered yet.
     */
    async loadTextTops() {
      if (!this.pdf) {
        return;
      }
      await Promise.all(this.annotations.filter(anno => !this.textTops.has(anno.id)).map(async anno => {
        const selectors = anno.selectors?.target?.[0]?.selector;
        const pageNumber = selectors?.find(s => s.type === "PagePositionSelector")?.number;
        const offset = selectors?.find(s => s.type === "TextPositionSelector")?.start;
        const top = pageNumber && offset !== undefined
          ? await this.pdf.getTextTop(pageNumber - 1, offset).catch(() => undefined)
          : null;
        if (top !== undefined) {
          this.textTops.set(anno.id, top);
        }
      }));
    },
    /**
     * Returns the viewport y-coordinate of the annotation: its first highlight once the page is rendered,
     * otherwise the estimate from the text layout, or the top of its page if there is none.
     */
    getPosition(anno, pages) {
      const highlight = anno.anchors?.[0]?.highlights?.[0];
      if (highlight && highlight.isConnected && !isInPlaceholder(highlight)) {
        return highlight.getBoundingClientRect().top;
      }
      const pageNumber = anno.selectors?.target?.[0]?.selector?.find(s => s.type === "PagePositionSelector")?.number;
      const wrapper = pages[pageNumber - 1]?.querySelector(".canvasWrapper");
      if (!wrapper) {
        return null;
      }
      const rect = wrapper.getBoundingClientRect();
      return rect.top + (this.textTops.get(anno.id) ?? 0) * rect.width;
    },
    /** Scrolls the viewer to the given annotation. @param {number} annotationId */
    jumpTo(annotationId) {
      this.eventBus.emit("pdfScroll", annotationId);
    },
  },
};
</script>

<style scoped>
/* Sits next to the scrollbar, not on top of it: the native scrollbar takes clicks even when covered */
.scroll-markers-anchor {
  position: relative;
  width: 8px;
  flex-shrink: 0;
}

.scroll-markers {
  position: absolute;
  top: 1px;
  bottom: 1px;
  left: 0;
  right: 0;
}

/* 9px click target around a 3px visible line */
.scroll-marker {
  position: absolute;
  left: 0;
  right: 0;
  height: 9px;
  margin-top: -3px;
  cursor: pointer;
}

.scroll-marker::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 3px;
  height: 3px;
  background-color: var(--marker-color, var(--bs-primary));
  opacity: 0.8;
}

.scroll-marker:hover::before {
  opacity: 1;
}

/* Opens to the left of the marker column, over the viewer */
.scroll-marker-preview {
  position: absolute;
  right: calc(100% + 4px);
  width: 280px;
  z-index: 1050;
  pointer-events: none;
}
</style>
