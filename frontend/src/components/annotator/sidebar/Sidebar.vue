<template>
  <!-- Edits Section: Only visible when there are edits and no annotations -->
  <SidebarEditHistory v-if="showEdits" :edits="edits" @show-edit="$emit('add-edit', $event)"/>
  <!-- Annotations Section: Always visible unless edits exist -->
  <!-- ARIA feed: Page Down / Page Up move between annotation cards -->
  <ul
    v-if="showAnnotations"
    id="anno-list"
    class="list-group"
    role="feed"
    :aria-label="$t('annotator.annotations')"
    @keydown.page-down.exact="moveToCard($event, 1)"
    @keydown.page-up.exact="moveToCard($event, -1)"
  >
    <ReadOnlyNotice v-if="componentReadOnly"/>
    <li
      v-for="(comment, index) in documentComments"
      :id="'comment-' + comment.id"
      :key="'documentComment-' + comment.id"
      class="list-group-i"
      role="article"
      :aria-posinset="index + 1"
      :aria-setsize="documentComments.length"
      @mouseleave="setHighlightFocus(comment.annotationId, false)"
      @mouseover="setHighlightFocus(comment.annotationId, true)"
    >
      <AnnoCard
        :id="comment.id"
        :ref="'annocard' + comment.id"
        :comment-id="comment.id"
        @focus="sidebarScrollTo"
        @new-anno-card="changeSideBarView"
      />
    </li>

    <li v-if="!componentReadOnly" id="addPageNote" role="none">
      <BasicButton
        class="anno-doc-note"
        icon="plus-lg"
        :text="$t('annotator.documentNote')"
        @click="createDocumentComment"
      />
    </li>
  </ul>
</template>

<script>
import SidebarEditHistory from "./SidebarEditHistory.vue";
import AnnoCard from "./card/AnnoCard.vue";
import ReadOnlyNotice from "./ReadOnlyNotice.vue";
import { resolveApiMessage } from "@/assets/utils";
import { scrollElement } from "@/assets/anchoring/scroll";
import BasicButton from "@/basic/Button.vue";

/** Sidebar component of the Annotator
 *
 * Here the annotations are listed and can be modified, also includes scrolling feature.
 *
 * @author Nils Dycke, Dennis Zyska, Marina Sakharova
 */
export default {
  name: "AnnotationSidebar",
  subscribeTable: ["comment", "annotation"],
  components: {SidebarEditHistory, ReadOnlyNotice, AnnoCard, BasicButton},
  inject: {
    // Whether the study step this sidebar belongs to is on screen; outside a study always true
    isStepShown: {
      default: true,
    },
    // Shows the sidebar tab that holds an element (basic/Sidebar.vue)
    showSidebarTabOf: {
      default: () => () => false,
    },
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
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    currentStudyStep: {
      type: Object,
      required: false,
      default: null
    },
    acceptStats: {
      default: () => false
    },
    showAllDocumentAnnotations: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  props: {
    edits: {
      type: Array,
      required: false,
      default: () => []
    },
  },
  emits: ['copy', 'add-edit', 'new-anno-card', 'scroll-to-comment'],
  computed: {
    componentReadOnly() {
      if(!this.readOnly) {
        return this.currentStudyStep?.configuration?.readOnlyComponents?.includes('annotator') || false;
      }
      return this.readOnly;
    },
    showEdits() {
      return this.edits && Object.keys(this.edits).length > 0 && this.documentComments.length === 0;
    },
    showAnnotations() {
      return !this.showEdits; // Show annotations only if `showEdits` is false
    },
    openSessionIds() {
      return this.$store.getters["table/study_session/getAll"].filter(
        session => {
          const study = this.$store.getters["table/study/get"](session.studyId);
          return study && study.closed == null;
        }
      ).map(session => session.id);
    },
    study() {
      if (this.studySession) {
        return this.$store.getters["table/study/get"](this.studySession.studyId);
      }
      return null;
    },
    studySession() {
      if (this.studySessionId && this.studySessionId !== 0) {
        return this.$store.getters["table/study_session/get"](this.studySessionId);
      }
      return null;
    },
    studySessionIds() {
      if (this.study) {
        return this.$store.getters["table/study_session/getByKey"]("studyId", this.studySession.studyId)
          .map(s => s.id);
      }
      return null;
    },
    showAll() {
      const showAllComments = this.$store.getters['settings/getValue']("annotator.showAllComments");
      return (showAllComments !== undefined && showAllComments);
    },
    downloadBeforeStudyClosingAllowed() {
      return this.$store.getters["settings/getValue"]("annotator.download.enabledBeforeStudyClosing") === "true"
    },
    documentComments() {
      return this.$store.getters["table/comment/getFiltered"](comm => comm.documentId === this.documentId && comm.parentCommentId === null)
        .filter(comment => {
          // if the studySessionId is set, we are in study session mode
          if (this.studySessionId) {
            // When showAllDocumentAnnotations is true, show all comments for the document
            if (this.showAllDocumentAnnotations && comment.studySessionId === null && comment.studyStepId === null) {
              return true;
            }
            // Otherwise, only show comments for current session and step
            return comment.studySessionId === this.studySessionId && comment.studyStepId === this.studyStepId;
          } else if (this.studySessionIds) {
            return this.studySessionIds.includes(comment.studySessionId);
          } else {
            if (this.showAll) {
              if (!this.downloadBeforeStudyClosingAllowed) {
                return !this.openSessionIds.includes(comment.studySessionId);
              } else {
              return true;
              }
            } else {
              return comment.studySessionId === null;
            }
          }
        })
        .sort((a, b) => {
          if (!a.annotationId && !b.annotationId) {
            return Date.parse(a) - Date.parse(b);
          } else if (a.annotationId && b.annotationId) {
            const aAnno = this.$store.getters['table/annotation/get'](a.annotationId);
            const bAnno = this.$store.getters['table/annotation/get'](b.annotationId);

            if (!aAnno || !bAnno) {
              return 0;
            }
            return (aAnno.selectors.target[0].selector.find(s => s.type === "TextPositionSelector").start
              - bAnno.selectors.target[0].selector.find(s => s.type === "TextPositionSelector").start);
          } else {
            return !a.annotationId ? 1 : -1;
          }
        });
    },
    anonymized() {
      if (!this.study) return false;
      return this.study.anonymize;
    }
  },
  mounted() {
    this.eventBus.on('sidebarScroll', this.onSidebarScroll);
  },
  beforeUnmount() {
    this.eventBus.off('sidebarScroll', this.onSidebarScroll);
  },
  methods: {
    /**
     * Scrolls to the comment of a clicked annotation and logs it. Several sidebars can be mounted at once (hidden study
     * steps, look-back tabs), so only one that lists the annotation and belongs to a step on screen handles it.
     * @param {number} annotationId - the clicked annotation
     */
    async onSidebarScroll(annotationId) {
      // in case the comment might not be loaded yet, or belongs to another document or step
      const wanted = Number(annotationId);
      const comment = this.documentComments.find(comm => comm.annotationId === annotationId || comm.annotationId === wanted);
      if (!comment || !this.isStepShown) {
        return;
      }
      const context = {
        documentId: this.documentId, studySessionId: this.studySessionId, studyStepId: this.studyStepId,
        ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}),
      };
      // The card may be in a tab that is not open, e.g. an earlier step's tab next to the current one: open it first,
      // so the scroll goes to a card on screen
      if (this.showSidebarTabOf(this.$refs["annocard" + comment.id]?.[0]?.$el)) {
        await this.$nextTick();
      }

      this.sidebarScrollTo(comment.id);
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "sidebarScroll",
          data: {
            ...context,
            annotationId: annotationId
          }
        });
      }
    },
    /**
     * Moves focus to the next or previous annotation card header (ARIA feed pattern).
     * Ignored while typing, so Page Up/Down still scroll text fields and dropdowns.
     * @param {KeyboardEvent} event - the Page Up / Page Down keydown on the feed
     * @param {number} direction - 1 for the next card, -1 for the previous card
     * @returns {void}
     */
    moveToCard(event, direction) {
      if (event.target.closest('textarea, input, select, [contenteditable="true"]')) return;
      const cards = [...event.currentTarget.querySelectorAll(':scope > li[role="article"]')];
      const index = cards.indexOf(event.target.closest('li[role="article"]'));
      const next = index === -1 ? cards[direction > 0 ? 0 : cards.length - 1] : cards[index + direction];
      // The chevron is hidden while a card is being edited, so fall back to its first control
      const header = next && (next.querySelector('.card-focusable') || next.querySelector('textarea, button'));
      if (!header) return;
      event.preventDefault();
      header.focus();
    },
    changeSideBarView() {
      this.$emit("new-anno-card");
    },
    /**
     * Marks the highlights of a hovered card's annotation in the document.
     * @param {number|null} annotationId - annotation of the card, null for document notes
     * @param {boolean} focused - whether the card is hovered
     */
    setHighlightFocus(annotationId, focused) {
      const annotation = annotationId && this.$store.getters['table/annotation/get'](annotationId);
      if (!annotation || !("anchors" in annotation) || annotation.anchors == null) return;
      annotation.anchors
        .filter(anchor => "highlights" in anchor)
        .forEach(anchor => anchor.highlights.forEach((highlight) => {
          if ("svgHighlight" in highlight) {
            highlight.svgHighlight.classList.toggle("is-focused", focused);
          }
          highlight.classList.toggle("highlight-focus", focused);
        }));
    },
    async sidebarScrollTo(commentId) {
      const card = document.getElementById('comment-' + commentId);
      if (!card) return;
      const scroller = this.scrollParent(card);
      if (scroller) {
        const top = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        await scrollElement(scroller, Math.max(0, top - 12));
      }

      if (this.$refs["annocard" + commentId]) {
        this.$refs["annocard" + commentId][0].putFocus();
      }
    },
    scrollParent(element) {
      let node = element.parentElement;
      while (node) {
        const overflow = getComputedStyle(node).overflowY;
        if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    },
    createDocumentComment() {
      this.$socket.emit('commentUpdate', {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        annotationId: null,
        commentId: null,
        anonymous: this.anonymized
      }, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.annotator.commentNotUpdated'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
  }
}
</script>

<style scoped>

#anno-list .list-group-i {
  border: none;
  background-color: transparent;
  margin-top: 4px;
  margin-left: 2px;
  margin-right: 2px;
}

#anno-list {
  list-style-type: none;
}

#addPageNote {
  padding: .75rem .75rem 0;
}

#addPageNote .anno-doc-note {
  width: 100%;
  border: 1px dashed color-mix(in srgb, var(--bs-secondary-color) 42%, var(--bs-border-color));
  border-radius: var(--care-radius-md);
  background: transparent;
  color: var(--bs-secondary-color);
  padding: .55rem .75rem;
}

</style>
