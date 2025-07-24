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
                      <button class="btn btn-primary btn-sm" @click="handleEditClick(edit)">
                        Show
                      </button>
                    </template>
                  </SideCard>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Annotations Section: Always visible unless edits exist -->
        <ul v-if="showAnnotations" id="anno-list" class="list-group">
          <li v-if="documentComments.length === 0">
            <p class="text-center">No elements</p>
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
            />
          </li>

          <li v-if="!readOnly" id="addPageNote">
            <button
              class="btn btn-light"
              type="button"
              @click="createDocumentComment"
            >
              <svg
                class="bi bi-plus-lg"
                fill="currentColor"
                height="16"
                viewBox="0 0 16 16"
                width="16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"
                  fill-rule="evenodd"
                />
              </svg>
              Document Note
            </button>
          </li>
        </ul>
      </div>
    </div>
    <ConfirmModal ref="leavePageConf"/>
  </div>
</template>

<script>
import SideCard from "./card/Card.vue";
import AnnoCard from "./card/AnnoCard.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import {scrollElement} from "@/assets/anchoring/scroll";

/** Sidebar component of the Annotator
 *
 * Here the annotations are listed and can be modified, also includes scrolling feature.
 *
 * @author Nils Dycke, Dennis Zyska
 */
export default {
  name: "AnnotationSidebar",
  components: {SideCard, AnnoCard, ConfirmModal},
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
    acceptStats: {
      default: () => false
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
      required: true,
      default: () => []
    },
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
      return !this.showEdits; // Show annotations only if `showEdits` is false
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
          // if the studySessionId is set, we are in study session mode
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
    show(newVal) {
      if (newVal) {
        this.width = this.originalWidth;
        this.isFixed = false;
        this.isHovering = false;
      }
    }
  },
  mounted() {
    this.minWidth = this.$store.getters["settings/getValue"]("annotator.sidebar.minWidth");
    this.maxWidth = this.$store.getters["settings/getValue"]("annotator.sidebar.maxWidth");
    this.width = this.$store.getters["settings/getValue"]("sidebar.width") || this.minWidth;
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
    this.initDragController()
    this.initHoverController()
  },
  methods: {
    handleEditClick(edit) {
      this.$emit("add-edit", edit.text);
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
      const scrollContainer = this.$refs.sidepane;
      await scrollElement(scrollContainer, document.getElementById('comment-' + commentId).offsetTop - 52.5);

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
    async leave() {
      if (this.documentComments.filter(c => c.draft).length > 0) {
        return new Promise((resolve) => {
          this.$refs.leavePageConf.open(
            "Unsaved Annotations",
            "Are you sure you want to leave the annotator? There are unsaved annotations, which will be lost.",
            null,
            function (val) {
              return resolve(val);
            });
        });
      } else {
        return true;
      }
    },
    /**
     * Initializes the drag controller for the sidebar
     *
     * When the mouse is pressed on the hot zone, the sidebar can be resized
     *
     * @author Zheyu Zhang
     */
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
    /**
     * Initializes the hover controller for the sidebar
     *
     * When the mouse enters the hover zone, the sidebar will be fixed
     *
     * @author Zheyu Zhang
     */
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
    /**
     * Registers the sidebar blur event
     *
     * @author Zheyu Zhang
     */
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
  overflow-y: scroll;
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
