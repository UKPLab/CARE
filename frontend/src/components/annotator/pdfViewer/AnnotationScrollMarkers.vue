<template>
  <div class="scroll-markers-anchor">
    <div class="scroll-markers">
      <div
        v-for="marker in markers"
        :key="marker.id"
        class="scroll-marker"
        :style="{top: marker.top + '%', '--marker-color': marker.color}"
        @click="jumpTo(marker.id)"
      />
    </div>
  </div>
</template>

<script>
import debounce from "lodash.debounce";
import {isInPlaceholder} from "@/assets/anchoring/placeholder";
import {getCollapsedAnnotationIds, getSessionScope, getTagColor, isInSessionScope} from "@/assets/annotations";

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
  data() {
    return {
      markers: [],
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
  },
  watch: {
    annotations() {
      this.updateMarkers();
    },
  },
  created() {
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
    observeContent() {
      Array.from(this.container.children).forEach(child => this.resizeObserver.observe(child));
    },
    computeMarkers() {
      const container = this.container;
      if (!container || container.scrollHeight === 0) {
        this.markers = [];
        return;
      }
      const pages = container.querySelectorAll(".scrolling-page");
      const contentTop = container.getBoundingClientRect().top - container.scrollTop;

      this.markers = this.annotations.map(anno => {
        const element = this.getPositionElement(anno, pages);
        if (!element) {
          return null;
        }
        const color = getTagColor(this.$store, anno.tagId);
        return {
          id: anno.id,
          top: (element.getBoundingClientRect().top - contentTop) / container.scrollHeight * 100,
          color: color ? "#" + color : null,
        };
      }).filter(marker => marker !== null);
    },
    /**
     * Returns the element marking the annotation's position: its first highlight once the page is rendered,
     * otherwise the top of its page (annotations only store text offsets and a page number, no y-coordinate).
     */
    getPositionElement(anno, pages) {
      const highlight = anno.anchors?.[0]?.highlights?.[0];
      if (highlight && highlight.isConnected && !isInPlaceholder(highlight)) {
        return highlight;
      }
      const pageNumber = anno.selectors?.target?.[0]?.selector?.find(s => s.type === "PagePositionSelector")?.number;
      return pages[pageNumber - 1] ?? null;
    },
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
</style>
