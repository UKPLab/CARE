<template>
  <!-- Edits Section: Only visible when there are edits and no annotations -->
  <div v-if="showEdits" class="edits-section">
    <div v-for="(dateGroups, dateCategory) in edits" :key="dateCategory">
      <h4 class="group-header">{{ dateCategory }}</h4>

      <div v-for="(group, exactDate) in dateGroups" :key="exactDate">
        <h5 class="date-header">{{ exactDate }}</h5>

        <ul class="list-group">
          <li v-for="edit in group" :key="edit.id" class="list-group-item">
            <SideCard>
              <template #header>
                {{ edit.timeLabel }} - Created by User {{ edit.userId }}
              </template>
              <template #body>
                <p>{{ edit.text }}</p>
              </template>
              <template #footer>
                <BasicButton
                  class="btn btn-primary btn-sm"
                  text="Show"
                  @click="handleEditClick(edit)"
                />
              </template>
            </SideCard>
          </li>
        </ul>
      </div>
    </div>
  </div>
  <!-- Annotations Section: Always visible unless edits exist -->
  <ul v-if="showAnnotations" id="anno-list" class="list-group">
    <li v-if="componentReadOnly" class="readonly-notice">
      <div class="card border-secondary mb-2">
        <div class="card-body text-center py-2">
          <LoadIcon
            icon-name="lock-fill"
            :size="20"
            color="#6c757d"
            class="mb-1"
          />
          <h6 class="card-title mb-0">Read-Only Mode</h6>
          <p class="card-text text-muted small mb-0">Annotations are view-only</p>
        </div>
      </div>
    </li>
    <li
      v-for="comment in documentComments"
      :id="'comment-' + comment.id"
      :key="'documentComment-' + comment.id"
      class="list-group-i"
      @mouseleave="unhover(comment.annotationId)"
      @mouseover="hover(comment.annotationId)"
    >
      <AnnoCard
        :id="comment.id"
        :ref="'annocard' + comment.id"
        :comment-id="comment.id"
        @focus="sidebarScrollTo"
        @new-anno-card="changeSideBarView"
      />
    </li>

    <li v-if="!componentReadOnly" id="addPageNote">
      <BasicButton
        class="btn btn-light"
        icon="plus-lg"
        text="Document Note"
        @click="createDocumentComment"
      />
    </li>
  </ul>
</template>

<script>
import SideCard from "./card/Card.vue";
import AnnoCard from "./card/AnnoCard.vue";
import LoadIcon from "@/basic/Icon.vue";
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
  components: {SideCard, AnnoCard, LoadIcon, BasicButton},
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
    show: {
      type: Boolean,
      required: false,
      default: true,
    },
    edits: {
      type: Array,
      required: false,
      default: () => []
    },
  },
  emits: ['copy', 'add-edit', 'new-anno-card', 'scroll-to-comment'],
  data() {
    return {
      width: 400,
      minWidth: 400,
      maxWidth: 50,
      isFixed: false,
      isDragging: false,
      sidebarContainerDom: undefined,
      originalWidth: undefined
    };
  },
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
    sidebarContainerStyle() {
      return {
        width: this.show || this.isFixed ? `${this.width}px` : 0
      }
    },
    sidebarContainerClassList() {
      return [
        this.show ? 'is-active' : 'is-hidden',
        this.isDragging ? 'is-dragging' : '',
        this.isFixed ? 'is-fixed' : ''
      ]
    },
    sidebarClassList() {
      return [this.show || this.isFixed ? 'is-active' : 'collapsing']
    },
    hasDrafts() {
      return this.$store.getters["table/comment/getFiltered"](e => e.draft).length > 0
        || this.$store.getters["table/annotation/getFiltered"](e => e.draft).length > 0;
    },
    anonymized() {
      if (!this.study) return false;
      return this.study.anonymize;
    }
  },
  watch: {
    hasDrafts(newVal) {
      // If opened from navigation
      if (this.show) return;
      // If sidebar is fixed
      if (newVal) {
        this.isFixed = true;
        this.width = this.minWidth;
        this.isHovering = true;
        this.registerSidebarBlurEvent();
      }
    },
  },
  mounted() {
    this.originalWidth = this.width;
    this.eventBus.on('sidebarScroll', (annotationId) => {
      const comment = this.$store.getters["table/comment/getByKey"]("annotationId", annotationId)
        .find(comm => comm.parentCommentId === null);
      // in case the comment might not be loaded yet
      if (!comment) {
        return;
      }

      this.sidebarScrollTo(comment.id);
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "sidebarScroll",
          data: {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            annotationId: annotationId
          }
        });
      }
    })
  },
  methods: {
    handleEditClick(edit) {
      this.$emit("add-edit", edit.text);
    },
    changeSideBarView() {
      this.$emit("new-anno-card");
    },
    hover(annotationId) {
      if (annotationId) {
        const annotation = this.$store.getters['table/annotation/get'](annotationId);
        if (annotation && "anchors" in annotation && annotation.anchors != null) {
          annotation.anchors
            .filter(anchor => "highlights" in anchor)
            .forEach(anchor => anchor.highlights.map((highlight) => {
              if ("svgHighlight" in highlight) {
                highlight.svgHighlight.classList.add("is-focused");
              }
              highlight.classList.add("highlight-focus");
            }))
        }
      }
    },
    unhover(annotationId) {
      if (annotationId) {
        const annotation = this.$store.getters['table/annotation/get'](annotationId);
        if (annotation && "anchors" in annotation && annotation.anchors != null) {
          annotation.anchors
            .filter(anchor => "highlights" in anchor)
            .forEach(anchor => anchor.highlights.map((highlight) => {
              if ("svgHighlight" in highlight) {
                highlight.svgHighlight.classList.remove("is-focused");
              }
              highlight.classList.remove("highlight-focus");
            }))
        }
      }
    },
    async sidebarScrollTo(commentId) {
      this.$emit("scroll-to-comment", document.getElementById('comment-' + commentId).offsetTop - 52.5);

      //await scrollElement(scrollContainer, document.getElementById('comment-' + commentId).offsetTop - 52.5);

      if (this.$refs["annocard" + commentId]) {
        this.$refs["annocard" + commentId][0].putFocus();
      }
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
            title: "Comment not updated",
            message: res.message,
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
  padding-top: 1rem;
  text-align: center;
}

#addPageNote .btn {
  border: none;
  color: #575757;
}

.readonly-notice {
  padding: 4px;
  list-style: none;
}

.readonly-notice .card {
  background-color: #f8f9fa;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.readonly-notice .card-body {
  padding: 8px 12px;
}

.readonly-notice .card-title {
  color: #495057;
  font-weight: 600;
  font-size: 0.875rem;
}

.readonly-notice .card-text {
  font-size: 0.75rem;
}

.edits-section {
  padding: 10px;
  border-bottom: 1px solid #ddd;
  margin-bottom: 10px;
}

.section-header {
  font-weight: bold;
  font-size: 1rem;
  margin-bottom: 8px;
}

#edit-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.list-group-item {
  border: none;
  background-color: transparent;
  margin-top: 8px;
}
</style>
