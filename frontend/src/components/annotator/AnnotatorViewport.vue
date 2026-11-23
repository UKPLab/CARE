<template>
  <div
      :id="'viewerContainer-' + documentId"
      ref="viewer"
      class="annotator-viewer flex-grow-1 border mh-100 justify-content-center p-3"
  >
    <PDFViewer
        ref="pdfViewer"
        class="rounded border border-1 shadow-sm"
        style="margin:auto"
        @copy="$emit('copy')"
        @loaded="$emit('loaded', $event)"
    />
  </div>
</template>

<script>
/**
 * Scrolling viewport of the annotator
 *
 * Holds the PDF and owns its scroll position: it restores the position saved for this document and step, saves it
 * again when the annotator closes, scrolls to an annotation when one is selected elsewhere (pdfScroll) and logs
 * scroll activity.
 *
 * @author Dennis Zyska, Marina Sakharova
 */
import PDFViewer from "./pdfViewer/PDFViewer.vue";
import {offsetRelativeTo, scrollElement, scrollToPage} from "@/assets/anchoring/scroll";
import {isInPlaceholder} from "@/assets/anchoring/placeholder";
import {resolveAnchor} from "@/assets/anchoring/resolveAnchor";
import debounce from 'lodash.debounce';

export default {
  name: "AnnotatorViewport",
  components: {PDFViewer},
  inject: {
    documentId: {default: 0},
    studyStepId: {default: null},
    isStepShown: {default: true},
    hiddenStudyStepId: {default: null},
    studySessionId: {default: null},
    currentStudyStep: {default: null},
    acceptStats: {default: () => false},
  },
  props: {
    // Anchors of the annotations shown in the annotator
    anchors: {type: Array, required: true},
  },
  emits: ['copy', 'loaded'],
  data() {
    return {
      logScroll: debounce(function (data) {
        if (this.acceptStats) {
          this.$socket.emit("stats", {
            action: "annotatorScrollActivity",
            data,
          })
        }
      }, 500),
    }
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    savedScroll() {
      // Normalize to a single record or null for simpler consumers
      return this.$store.getters['table/user_environment/getAll'].find(
          e => e.userId === this.userId &&
              e.documentId === this.documentId &&
              e.studySessionId === this.studySessionId &&
              e.studyStepId === this.studyStepId &&
              e.key === "scroll"
      ) || null;
    },
  },
  watch: {
    // React to external changes to the saved scroll value (e.g., from store updates)
    async savedScroll(newVal) {
      if (newVal) {
        await this.scrollToSavedValue(newVal.value, 1000);
      }
    },
  },
  mounted() {
    this.eventBus.on('pdfScroll', this.onPdfScroll);
    this.$refs.viewer.addEventListener("scroll", this.scrollActivity);
    // Scroll the viewer container to the saved scroll position
    this.$nextTick(async () => {
      if (this.savedScroll) {
        await this.scrollToSavedValue(this.savedScroll.value, 300);
      }
    });
  },
  beforeUnmount() {
    this.logScroll.flush();
    this.eventBus.off('pdfScroll', this.onPdfScroll);
    this.$refs.viewer.removeEventListener("scroll", this.scrollActivity);

    const value = JSON.stringify({page: this.getCurrentPageNumber(), value: this.$refs.viewer.scrollTop});
    this.$socket.emit("appDataUpdate", {
      table: "user_environment",
      data: this.savedScroll ? {id: this.savedScroll.id, value} : {
        userId: this.userId,
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        key: "scroll",
        value,
      },
    });
  },
  methods: {
    /** Handles annotation jumps only in the addressed visible document and step. */
    onPdfScroll(payload) {
      const annotationId = typeof payload === "object" ? payload.annotationId : payload;
      const annotation = this.$store.getters["table/annotation/get"](annotationId);
      if (!annotation || annotation.documentId !== this.documentId || !this.isStepShown ||
          (this.studyStepId != null && this.hiddenStudyStepId === this.studyStepId)) return;
      // Older callers pass only an ID; scoped callers also disambiguate reused PDFs and document-level annotations.
      const target = typeof payload === "object" ? payload : {
        studyStepId: annotation.studyStepId ?? this.currentStudyStep?.id,
        studySessionId: annotation.studySessionId,
      };
      if ((target.documentId != null && target.documentId !== this.documentId) ||
          (target.studyStepId != null && target.studyStepId !== this.studyStepId) ||
          (target.studySessionId != null && target.studySessionId !== this.studySessionId)) return;
      this.scrollTo(annotationId);
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "pdfScroll",
          data: {
            documentId: this.documentId, studySessionId: this.studySessionId, studyStepId: this.studyStepId,
            ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}), annotationId,
          },
        });
      }
    },
    async scrollToSavedValue(value, delayMs) {
      const data = JSON.parse(value);
      const container = this.$refs.viewer;
      await this.delay(delayMs);
      if (!this.isPdfPageLoaded(parseInt(data.page))) {
        scrollToPage(container, data.page, {align: 'start', offset: 0});
        await this.delay(300);
      }
      await scrollElement(container, parseFloat(data.value));
    },
    getCurrentPageNumber() {
      //Todo get current page in a better way
      const container = this.$refs.viewer;
      if (!container) return 1;
      const pages = container.querySelectorAll('.scrolling-page' );
      if (!pages || pages.length === 0) return 1;
      let bestIndex = 0;
      let bestDist = Infinity;
      const currentTop = container.scrollTop;
      pages.forEach((el, idx) => {
        const relTop = offsetRelativeTo(el, container);
        const dist = Math.abs(relTop - currentTop);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = idx;
        }
      });
      return bestIndex + 1; // pages are 1-based
    },
    isPdfPageLoaded(pageNumber) {
      const canvas = document.getElementById('pdf-canvas-' + pageNumber + '-' + this.documentId);
      const visible = canvas ? getComputedStyle(canvas).visibility === 'visible' : false;
      const hasDimensions = !!(canvas && canvas.width > 0 && canvas.height > 0);
      return visible && hasDimensions;
    },
    scrollActivity() {
      this.logScroll({
        documentId: this.documentId,
        ...(this.studySessionId ? {studySessionId: this.studySessionId} : {}),
        ...(this.studyStepId ? {studyStepId: this.studyStepId} : {}),
        ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}),
        scrollTop: this.$refs.viewer.scrollTop,
        scrollHeight: this.$refs.viewer.scrollHeight,
      });
    },
    async scrollTo(annotationId) {
      const annotation = this.$store.getters['table/annotation/get'](annotationId);
      const scrollContainer = this.$refs.viewer || document.getElementById('viewerContainer-' + this.documentId);
      const hasAnchors = Array.isArray(annotation.anchors) && annotation.anchors.length > 0;
      if (hasAnchors) {
        const anchor = annotation.anchors[0];
        const range = resolveAnchor(anchor);
        if (!range) {
          return;
        }

        const inPlaceholder = this.anchorIsInPlaceholder(anchor);
        let offset = this._anchorOffset(anchor);
        if (offset === null) {
          return;
        }
        // Correct offset since we have a fixed top
        offset -= 123; // see css class padding-top
        // nb. We only compute the scroll offset once at the start of scrolling.
        // This is important as the highlight may be removed from the document during
        // the scroll due to a page transitioning from rendered <-> un-rendered.
        await scrollElement(scrollContainer, offset);

        if (inPlaceholder) {
          const anchor = await this._waitForAnnotationToBeAnchored(
              annotation,
              3000
          );
          if (!anchor) {
            return;
          }
          let offset = this._anchorOffset(anchor);
          if (offset === null) {
            return;
          }
          await scrollElement(scrollContainer, offset);
        }
      } else {
        await scrollToPage(scrollContainer, annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number, {
          align: 'start',
          maxDuration: 10
        });
        await this._waitForAnnotationToBeAnchored(annotation, 2000);
        if (annotation.anchors === null) {
          console.error('[scrollTo] No anchors found after paging', annotation);
          return;
        }
        let offset = this._anchorOffset(annotation.anchors[0]);
        if (offset === null) {
          return;
        }
        offset -= 106;
        await scrollElement(scrollContainer, offset);
      }
    },
    anchorIsInPlaceholder(anchor) {
      const highlight = anchor.highlights?.[0];
      return highlight && isInPlaceholder(highlight);
    },
    _anchorOffset(anchor) {
      const container = this.$refs.viewer;
      const highlight = anchor.highlights?.find(element => container.contains(element));
      return highlight ? offsetRelativeTo(highlight, container) : null;
    },
    async _waitForAnnotationToBeAnchored(annotation, maxWait) {
      const start = Date.now();
      let anchor;
      do {
        // nb. Re-anchoring might result in a different anchor object for the
        // same annotation.
        anchor = this.anchors.find(a => a.annotation === annotation);
        if (!anchor || this.anchorIsInPlaceholder(anchor)) {
          anchor = null;

          // If no anchor was found, wait a bit longer and check again to see if
          // re-anchoring completed.
          await this.delay(20);
        }
      } while (!anchor && Date.now() - start < maxWait);
      return anchor ?? null;
    },
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
  },
};
</script>

<style scoped>
.annotator-viewer {
  /* auto would freeze this column at the widened page width. */
  min-width: 0;
  overflow-y: scroll;
}
</style>
