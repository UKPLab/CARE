<template>
  <span>
    <PDFAnnotationHighlight v-for="annotation in pageAnnotations" :key="annotation.id" ref="highlights" :annotation="annotation"/>
  </span>
</template>

<script>
import PDFAnnotationHighlight from "./PDFAnnotationHighlight.vue";
import {getCollapsedAnnotationIds, getSessionScope, isInSessionScope} from "@/assets/annotations";

/**
 * Highlights handling of annotation in pdf document
 *
 * This component creates the highlights of all the annotations inside the pdf document
 *
 * Adapted from Hypothes.is
 *
 * @author Dennis Zyska, Nils Dycke, Marina Sakharova
 */
export default {
  name: "PDFHighlights",
  components: {PDFAnnotationHighlight},
  subscribeTable: ['comment_state', 'comment'],
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
    }
  },
  props: {
    'pageId': {
      type: Number,
      required: true,
    }
  },
  computed: {
    pageAnnotations() {
      return this.annotations.filter(anno => anno.selectors.target[0].selector.find(selector => selector.type === "PagePositionSelector").number === this.pageId);
    },
    sessionScope() {
      return getSessionScope(this.$store, {
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        showAllDocumentAnnotations: this.showAllDocumentAnnotations,
      });
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    commentStates() {
      return this.$store.getters['table/comment_state/getAll'].filter(state => state.documentId === this.documentId && this.filterBySessionAndSettings(state)).filter(state => this.getAnnotationByCommentState(state)?.anchors === null);
    },
    collapsedAnnotationIds() {
      return getCollapsedAnnotationIds(this.$store, this.documentId);
    },
    annotations() {
      const allAnnotations = this.$store.getters['table/annotation/getAll']
        .filter(e => {
          const isDocumentMatch = e.documentId === this.documentId;
          const hasAnchors = e.anchors !== null
          // const isPageMatch = e.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === this.pageId;
          return isDocumentMatch && hasAnchors
        }).filter(anno => this.filterBySessionAndSettings(anno));

      // Filter by collapsedAnnotationIds
      const filteredAnnotations = allAnnotations.filter(anno => !this.collapsedAnnotationIds.includes(anno.id));
      return filteredAnnotations;
    },

  },
  watch: {
    commentStates(newVal, oldVal) {
      newVal.filter(s => !oldVal.includes(s)).forEach(state => {
        const annotation = this.getAnnotationByCommentState(state);
        if (!annotation) {return false};
        const annotationPage = annotation?.selectors?.target?.[0]?.selector?.find(s => s.type === 'PagePositionSelector').number;
        const isCollapsed = this.collapsedAnnotationIds.includes(annotation.id);
        const isPageLoaded = this.isPdfPageLoaded(annotationPage);
        if (!isPageLoaded && !isCollapsed) {
          this.handleScrolling(annotation.id);
        }
      });
    },
    annotations(newVal, oldVal) {
      // Remove highlights of deleted anchors
      oldVal.filter(anno => !newVal.includes(anno))
        .forEach(anno => {
          anno.anchors = null;
        });

      // Add highlights for new annotations
       newVal.filter(anno => !oldVal.includes(anno) && anno.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === this.pageId)
        .map(anno => {
          if(!this.collapsedAnnotationIds.includes(anno.id)) {
            this.handleScrolling(anno.id);
          }
        });
    },

  },

  methods: {
    // Check if a given PDF page is loaded/rendered
    isPdfPageLoaded(pageNumber) {
        const canvas = document.getElementById('pdf-canvas-' + pageNumber + '-' + this.documentId);
        const visible = canvas ? getComputedStyle(canvas).visibility === 'visible' : false;
        const hasDimensions = !!(canvas && canvas.width > 0 && canvas.height > 0);
        const loaded = (visible && hasDimensions);
        return loaded;
    },
    filterBySessionAndSettings(anno) {
      return isInSessionScope(anno, this.sessionScope);
    },
    getCommentByAnnotationId(annotationId) {
      return this.$store.getters['table/comment/getFiltered'](
        comment => comment.annotationId === annotationId
      )[0];
    },
    getCommentStateByCommentId(commentId) {
      return this.$store.getters['table/comment_state/getFiltered'](
        state => state.commentId === commentId
      )[0];
    },

    handleScrolling(annotationId) {
      const isRecentlyUpdated = this.isRecentlyUpdated(annotationId);
      if (isRecentlyUpdated) {
        this.eventBus.emit('pdfScroll', {
          annotationId, documentId: this.documentId, studyStepId: this.studyStepId, studySessionId: this.studySessionId,
        });
      }
    },
    isRecentlyUpdated(annotationId) {
      const commentId = this.getCommentByAnnotationId(annotationId)?.id;
      if (!commentId) {
        return false;
      }
      const recentCommentState = this.getCommentStateByCommentId(commentId);
      if(!recentCommentState) {
        return false;
      }
      const now = Date.now();
      const oneSecondAgo = now - 1000; //check if it was just changed
      const updatedAtTimestamp = new Date(recentCommentState.updatedAt).getTime();
      if (updatedAtTimestamp >= oneSecondAgo) {
        return true;
      } else {
        return false;
      }
    },

    update_highlights() {
      this.$refs.highlights?.forEach(highlight => highlight.redraw());
    },



    removeAllHighlights(root) {
      const highlights = Array.from(root.querySelectorAll('highlight'));
      this.removeHighlights(highlights);
    },
    removeHighlights(highlights) {
      for (let h of highlights) {
        if (h.parentNode) {
          const children = Array.from(h.childNodes);
          const parent = /** @type {Node} */ (h.parentNode);
          children.forEach(r => parent.insertBefore(r, h));
          h.remove();
        }

        if (h.svgHighlight) {
          h.svgHighlight.remove();
        }
      }
    },
    /**
     * Return text nodes which are entirely inside `range`.
     *
     * If a range starts or ends part-way through a text node, the node is split
     * and the part inside the range is returned.
     *
     * @param {Range} range
     * @return {Text[]}
     */

    getAnnotationByCommentState(state) {
      const comment = this.$store.getters['table/comment/get'](state.commentId);
      if (!comment) return null;
      const annotation = this.$store.getters['table/annotation/get'](comment.annotationId);
      return annotation || null;
    },
  }
}
</script>
