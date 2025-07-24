<template>
  <div
    id="sidebarContainer"
    class="col border mh-100 col-sm-auto g-0"
    :class="sidebarContainerClassList"
    :style="sidebarContainerStyle"
  >
    <div id="hoverHotZone"></div>
    <div
      id="sidebar"
      :class="sidebarClassList"
      class="collapse collapse-horizontal border-end d-flex flex-column"
    >
      <div id="hotZone" class="hot-zone"></div>
      <div id="sidepane" ref="sidepane">
        <div id="spacer"></div>

        <EditsSection
          :edits="edits"
          :show-edits="showEdits"
          @edit-click="handleEditClick"
        />

        <AnnotationsList
          ref="annotationsList"
          :show-annotations="showAnnotations"
          :read-only="readOnly"
          :document-comments="documentComments"
          @create-document-comment="createDocumentComment"
          @scroll-to-comment="sidebarScrollTo"
        />
      </div>
    </div>
  </div>
</template>

<script>
import EditsSection from "./EditsSection.vue";
import AnnotationsList from "./AnnotationsList.vue";
import {scrollElement} from "@/assets/anchoring/scroll";

export default {
  name: "AnnotationSidebar",
  components: {EditsSection, AnnotationsList},
  inject: ['documentId', 'studySessionId', 'studyStepId', 'acceptStats'],
  props: {
    show: {
      type: Boolean,
      default: false
    },
    sidebarWidth: {
      type: Number,
      default: 300
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    edits: {
      type: Object,
      default: () => null
    }
  },
  emits: ['add-edit'],
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
    showEdits() {
      return this.edits && Object.keys(this.edits).length > 0 && this.documentComments.length === 0;
    },
    showAnnotations() {
      return !this.showEdits;
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
    documentComments() {
      return this.$store.getters["table/comment/getFiltered"](comm => comm.documentId === this.documentId && comm.parentCommentId === null)
        .filter(comment => {
          if (this.studySessionId) {
            return comment.studySessionId === this.studySessionId && comment.studyStepId === this.studyStepId;
          } else if (this.studySessionIds) {
            return this.studySessionIds.includes(comment.studySessionId);
          } else {
            if (this.showAll) {
              return true;
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
        })
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
      return this.study.anonymize;
    }
  },
  watch: {
    hasDrafts(newVal) {
      if (this.show) return;
      if (newVal) {
        this.isFixed = true;
        this.width = this.minWidth;
        this.isHovering = true;
        this.registerSidebarBlurEvent();
      }
    },
    show(newVal) {
      if (newVal) {
        this.width = this.originalWidth;
        this.isFixed = false;
        this.isHovering = false;
      }
    }
  },
  mounted() {
    this.initializeSidebar();
    this.setupEventListeners();
    this.initDragController();
    this.initHoverController();
  },
  methods: {
    initializeSidebar() {
      this.minWidth = this.$store.getters["settings/getValue"]("annotator.sidebar.minWidth");
      this.maxWidth = this.$store.getters["settings/getValue"]("annotator.sidebar.maxWidth");
      this.width = this.$store.getters["settings/getValue"]("sidebar.width") || this.minWidth;
      this.originalWidth = this.width;
    },
    
    setupEventListeners() {
      this.eventBus.on('sidebarScroll', (annotationId) => {
        const comment = this.$store.getters["table/comment/getByKey"]("annotationId", annotationId)
          .find(comm => comm.parentCommentId === null);
        
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
      });
    },
    
    handleEditClick(edit) {
      this.$emit("add-edit", edit.text);
    },
    
    async sidebarScrollTo(commentId) {
      const scrollContainer = this.$refs.sidepane;
      await scrollElement(scrollContainer, document.getElementById('comment-' + commentId).offsetTop - 52.5);

      const annoCardRef = this.$refs.annotationsList?.$refs["annocard" + commentId];
      if (annoCardRef && annoCardRef[0]) {
        annoCardRef[0].putFocus();
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
    
    async leave() {
      return true;
    },
    
    initDragController() {
      const dom = document.querySelector('#hotZone');
      const that = this;

      let startX, startWidth;
      const handleStart = (e) => {
        that.isDragging = true;
        e.preventDefault();
        document.body.style.userSelect = 'none';
        startWidth = this.width;
        startX = e.clientX;
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
      }

      const handleMove = (e) => {
        e.preventDefault();
        let newWidth = startWidth - (e.clientX - startX);
        const maxWidthInPixels = window.innerWidth * this.maxWidth / 100;
        newWidth = Math.max(newWidth, this.minWidth);
        newWidth = Math.min(newWidth, maxWidthInPixels);
        this.width = newWidth;
      }

      const handleEnd = () => {
        that.isDragging = false;
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.body.style.userSelect = '';
        this.$socket.emit("appSettingSet", {key: "sidebar.width", value: this.width});
        this.originalWidth = this.width;
      }

      dom.addEventListener('mousedown', handleStart);
    },
    
    initHoverController() {
      const hoverHotZoneDom = document.querySelector('#hoverHotZone');
      this.sidebarContainerDom = document.querySelector('#sidebarContainer');
      let hoverTimer;

      hoverHotZoneDom.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(() => {
          this.isFixed = true;
          this.width = this.minWidth;
          this.isHovering = true;
          this.sidebarContainerDom.addEventListener('mouseleave', handleMouseleave);
        }, 500);
      });

      const handleMouseleave = () => {
        clearTimeout(hoverTimer);
        this.width = this.originalWidth;
        this.isFixed = false;
        this.isHovering = false;
        this.sidebarContainerDom.removeEventListener('mouseleave', handleMouseleave);
      };

      hoverHotZoneDom.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
      });
    },
    
    registerSidebarBlurEvent() {
      const handleSidebarClick = (e) => {
        e.stopPropagation();
      };

      const handleBodyClick = () => {
        this.isFixed = false;
        this.isHovering = false;
        document.body.removeEventListener("click", handleBodyClick);
      };

      this.sidebarContainerDom.addEventListener("click", handleSidebarClick);
      document.body.addEventListener("click", handleBodyClick);
    }
  }
}
</script>

<style scoped>
#sidebar {
  height: 100%;
  width: 100%;
  position: relative;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  position: absolute;
}

#sidebar.is-active {
  transform: translateX(0);
}

#spacer {
  width: 400px;
  background-color: transparent;
}

#sidepane {
  padding-top: 5px;
  background-color: #e6e6e6;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

#sidepane::-webkit-scrollbar {
  width: 6px;
}

#sidepane::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

#sidepane::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

#sidepane::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

#anno-list .list-group-i {
  border: none;
  background-color: transparent;
  margin-top: 4px;
  margin-left: 2px;
  margin-right: 2px;
}

#anno-list {
  list-style-type: none;
  flex: 1;
  overflow-y: auto;
  padding: 0;
  margin: 0;
}

#addPageNote {
  padding-top: 1rem;
  text-align: center;
}

#addPageNote .btn {
  border: none;
  color: #575757;
}

#sidepane::-webkit-scrollbar {
  display: none;
}

.hot-zone {
  width: 3px;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  cursor: col-resize;
}

#sidebarContainer {
  position: relative;
  padding: 0;
  transition: width 0.3s ease;
  overflow-y: scroll;
}

#sidebarContainer.is-hidden {
  position: fixed;
  height: 100%;
  right: 0;
  width: 10px;
}

#sidebarContainer.is-hidden #hoverHotZone {
  display: block;
}

#sidebarContainer.is-dragging {
  transition: unset;
}

#sidebarContainer.is-fixed {
  position: fixed;
  right: 0;
}

#sidebarContainer.is-fixed .hot-zone {
  display: none;
}

#sidebarContainer::-webkit-scrollbar {
  display: none;
}

@media screen and (max-width: 900px) {
  #sidebarContainer {
    display: none;
  }
}

#hoverHotZone {
  position: fixed;
  height: 100%;
  width: 6px;
  top: 0;
  right: 0px;
  z-index: 999;
  display: none;
}
</style>
