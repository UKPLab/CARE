<template>
  <div
    id="sidebar-container"
    :class="(show ? 'show' : 'collapsing')"
    class="collapse collapse-horizontal border-end d-flex flex-column"
  >
    <div
      id="sidepane"
      ref="sidepane"
    >
      <div id="spacer"/>
      <ul
        id="anno-list"
        class="list-group"
      >
        <li v-if="documentComments.length === 0">
          <p class="text-center">
            No elements
          </p>
        </li>
        <li
          v-for="comment in documentComments"
          :id="'comment-' + comment.id"
          :key="'documentComment-' + comment.id"
          class="list-group-i"
          @mouseleave="unhover(comment.id)"
          @mouseover="hover(comment.id)"
        >
          <AnnoCard
            :id="comment.id"
            :comment-id="comment.id"
            @focus="sidebarScrollTo"
          />
        </li>

        <li
          v-if="!readonly"
          id="addPageNote"
        >
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
</template>

<script>
import {mapMutations} from "vuex";
import AnnoCard from "./card/AnnoCard.vue";
import ConfirmModal from "@/basic/ConfirmModal.vue"
import {scrollElement} from "@/assets/anchoring/scroll";

/** Sidebar component of the Annotator
 *
 * Here the annotations are listed and can be modified, also includes scrolling feature.
 *
 * @author Nils Dycke, Dennis Zyska
 */
export default {
  name: "AnnotationSidebar",
  components: {AnnoCard, ConfirmModal},
  inject: ['documentId', 'studySessionId', 'readonly'],
  props: {
    show: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  computed: {
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
      return this.$store.getters['comment/getDocumentComments'](this.documentId)
        .filter(comment => {
          // if the studySessionId is set, we are in study session mode
          if (this.studySessionId) {
            return comment.studySessionId === this.studySessionId;
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
            const aAnno = this.$store.getters['anno/getAnnotation'](a.annotationId);
            const bAnno = this.$store.getters['anno/getAnnotation'](b.annotationId);

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
  },
  mounted() {
    this.eventBus.on('sidebarScroll', (anno_id) => {
      const comment = this.$store.getters["comment/getCommentByAnnotation"](anno_id);
      // in case the comment might not be loaded yet
      if (!comment) {
        return;
      }

      this.sidebarScrollTo(comment.id);
      this.$socket.emit("stats", {
        action: "sidebarScroll",
        data: {documentId: this.documentId, studySessionId: this.studySessionId, anno_id: anno_id}
      });
    })
  },
  methods: {
    ...mapMutations({
      toggleSidebar: "anno/TOGGLE_SIDEBAR",
      annoHover: "anno/HOVER",
      annoUnhover: "anno/UNHOVER"
    }),
    hover(commentId) {
      const annotationId = this.$store.getters['comment/getComment'](commentId).annotationId;

      if (annotationId)
        this.annoHover(annotationId)
    },
    unhover(commentId) {
      const annotationId = this.$store.getters['comment/getComment'](commentId).annotationId;

      if (annotationId)
        this.annoUnhover(annotationId)
    },
    async sidebarScrollTo(commentId) {
      const scrollContainer = this.$refs.sidepane;
      await scrollElement(scrollContainer, document.getElementById('comment-' + commentId).offsetTop - 52.5);
    },
    createDocumentComment() {
      this.$socket.emit('commentUpdate', {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        annotationId: null,
        commentId: null
      });
    },
    async leave() {
      if (this.documentComments.filter(c => c.draft).length > 0) {
        return new Promise((resolve, reject) => {
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
    }
  }
}
</script>

<style scoped>
#sidebar-container {
  max-width: 400px;
  height: 100%;
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
  list-style-type: none
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
</style>