<template>
  <Loader
      v-if="documentId && documentId === 0"
      :loading="true"
      class="pageLoader"
  />
  <span v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
      <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
        <div
            id="viewerContainer"
            ref="viewer"
            class="col border mh-100 justify-content-center p-3"
            style="overflow-y: scroll;"
        >
          <PDFViewer
              ref="pdfViewer"
              class="rounded border border-1 shadow-sm"
              style="margin:auto"
          />

        </div>
        <Sidebar
            v-if="!sidebarDisabled"
            ref="sidebar" class="sidebar-container" :show="isSidebarVisible"
        />
      </div>
    </div>

    <Teleport to="#topBarNavItems">
      <li class="nav-item">
        <TopBarButton
            v-if="studySessionId === null && numStudyComments > 0"
            :title="showAll ? 'Hide study comments' : 'Show study comments'"
            class="btn rounded-circle"
            @click="setSetting({key: 'annotator.showAllComments', value: !showAll})"
        >
          <span class="position-relative translate-middle top-100 start-100 fs-10 fw-light">
            {{ numStudyComments }}
          </span>
          <span>
            <LoadIcon
                :icon-name="!showAll ? 'eye-slash-fill' : 'eye-fill'"
                :size="18"
            />
          </span>
        </TopBarButton>
      </li>
      <li class="nav-item">

        <TopBarButton
            v-if="studySessionId && studySessionId !== 0 ? active && nlpEnabled : nlpEnabled"
            :title="nlpActive ? 'Deactivate NLP support' : 'Activate NLP support'"
            class="btn rounded-circle"
            @click="toggleNlp"
        >
          <LoadIcon
              :color="(!nlpActive) ?'#777777':'#097969'"
              :size="18"
              icon-name="robot"
          />
        </TopBarButton>
        <TopBarButton
            v-show="studySessionId && studySessionId !== 0 ? active : true"
            :title="isSidebarVisible ? 'Hide sidebar' : 'Show sidebar'"
            class="btn rounded-circle"
            @click="toggleSidebar"
            :class="{ 'sidebar-highlight': sidebarIconHighlight }"
        >
          <LoadIcon
              :icon-name="isSidebarVisible ? 'layout-sidebar-inset-reverse' : 'layout-sidebar-reverse'"
              :size="18"
          />
        </TopBarButton>
      </li>
      <ExpandMenu v-show="studySessionId && studySessionId !== 0 ? active : true" class="nav-item"/>
    </Teleport>

    <!-- If download before study closing disabled and we are in a study session, no download allowed -->
    <Teleport to="#topBarExtendMenuItems">
      <li><a
          :class="annotations.length + comments.length > 0 && !downloading && (this.downloadBeforeStudyClosingAllowed || this.studySessionId === null)? '' : 'disabled'"
          class="dropdown-item"
          href="#"
          @click="downloadAnnotations"
      >Download
        Annotations</a></li>
    </Teleport>

    <Teleport to="#topbarCustomPlaceholder">
      <form class="hstack gap-3 container-fluid justify-content-center">
        <TopBarButton
            v-if="review"
            class="btn btn-outline-success me-2"
            @click="$refs.reviewSubmit.open()"
        >Submit Review
        </TopBarButton>
        <TopBarButton
            v-if="approve"
            class="btn btn-outline-dark me-2"
            @click="$refs.report.open()"
        >
          Report
        </TopBarButton>
        <TopBarButton
            v-if="approve"
            class="btn btn-outline-success me-2"
            @click="decisionSubmit(true)"
        >
          Accept
        </TopBarButton>
        <TopBarButton
            v-if="approve"
            class="btn btn-outline-danger me-2"
            @click="decisionSubmit(false)"
        >
          Reject
        </TopBarButton>
      </form>
    </Teleport>
  </span>
</template>

<script>
/** Annotator Component
 *
 * This parent component provides the annotation view, which
 * currently consists of all elements of the annotator.
 *
 * @author Dennis Zyska, Marina Sakharova
 */
import PDFViewer from "./pdfViewer/PDFViewer.vue";
import Sidebar from "./sidebar/Sidebar.vue";
import Loader from "@/basic/Loading.vue";
import {offsetRelativeTo, scrollElement, scrollToPage} from "@/assets/anchoring/scroll";
import {isInPlaceholder} from "@/assets/anchoring/placeholder";
import {resolveAnchor} from "@/assets/anchoring/resolveAnchor";
import debounce from 'lodash.debounce';
import LoadIcon from "@/basic/Icon.vue";
import ExpandMenu from "@/basic/navigation/ExpandMenu.vue";
import {mapMutations} from "vuex";
import {computed} from "vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import {mergeAnnotationsAndComments} from "@/assets/data";
import {downloadObjectsAs} from "@/assets/utils";

export default {
  name: "AnnotatorView",
  subscribeTable: ['tag', 'tag_set', 'user_environment', 'study', 'study_session', 'comment', 'annotation'],
  components: {
    LoadIcon,
    PDFViewer,
    ExpandMenu,
    Sidebar,
    Loader,
    TopBarButton
  },
  provide() {
    return {
      documentId: computed(() => this.documentId),
      studyStepId: computed(() => this.studyStepId)
    }
  },
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null
    },
    acceptStats: {
      type: Boolean,
      required: false,
      default: () => false
    },
    studyData: {
      type: Array,
      required: false,
      default: () => [],
    }
  },
  props: {
    approve: {
      type: Boolean,
      required: false,
      default: false,
    },
    review: {
      type: Boolean,
      required: false,
      default: false,
    },
    sidebarDisabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    documentId: {
      type: Number,
      required: true,
      default: 0,
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
    active: {
      type: Boolean,
      required: false,
      default: true,
    },

  },
  data() {
    return {
      downloading: false,
      isSidebarVisible: true,
      sidebarIconHighlight: false,
      logScroll: debounce(function () {
        if (this.acceptStats) {
          this.$socket.emit("stats", {
            action: "annotatorScrollActivity",
            data: {
              documentId: this.documentId,
              scrollTop: this.$refs.viewer.scrollTop,
              scrollHeight: this.$refs.viewer.scrollHeight
            }
          })
        }
      }, 500),
      logHideSidebar: debounce(function () {
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "hideSidebar",
          data: {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
          }
        });
      }
    }, 500),
      logResize: debounce(function (windowWidth, sidebarVisible) {
        if (this.acceptStats) {
          this.$socket.emit("stats", {
            action: "sidebarResize",
            data: {
              documentId: this.documentId,
              studySessionId: this.studySessionId,
              studyStepId: this.studyStepId,
              windowWidth: windowWidth,
              sidebarVisible: sidebarVisible
            }
          });
        }
      }, 500)
    }
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    savedScroll() {
      // Normalize to a single record or null for simpler consumers
      const data = this.$store.getters['table/user_environment/getAll'].filter(
        e => e.userId === this.userId &&
          e.documentId === this.documentId &&
          e.studySessionId === this.studySessionId &&
          e.studyStepId === this.studyStepId &&
          e.key === "scroll"
      );
      return data[0] || null;
    },
    anchors() {
      return [].concat(
          this.annotations.filter(a => a.anchors !== null)
              .flatMap(a => a.anchors)
              .filter(a => a !== undefined)
      )
    },
    showAll() {
      const showAllComments = this.$store.getters['settings/getValue']("annotator.showAllComments");
      return (showAllComments !== undefined && showAllComments);
    },

    nlpActive() {
      const nlpActive = this.$store.getters["settings/getValue"]("annotator.nlp.activated");
      return (nlpActive === true || nlpActive === "true");
    },
    nlpEnabled() {
      return this.$store.getters["settings/getValue"]('service.nlp.enabled') === "true";
    },
    numStudyComments() {
      return this.comments.filter(c => c.studySessionId).length;
    },
    // check if the setting is on or off
    downloadBeforeStudyClosingAllowed() {
      return this.$store.getters["settings/getValue"]("annotator.download.enabledBeforeStudyClosing") === "true"
    },
    openSessionIds() {
      return this.$store.getters["table/study_session/getAll"].filter(
        session => {
          const study = this.$store.getters["table/study/get"](session.studyId);
          return study && study.closed === null;
        }
      ).map(session => session.id);
    },
    annotations() {
      const annotations = this.$store.getters["table/annotation/getByKey"]('documentId', this.documentId).sort((a, b) => {
            const a_noanchor = a.anchors === null || a.anchors.length === 0;
            const b_noanchor = b.anchors === null || b.anchors.length === 0;

            if (a_noanchor || b_noanchor) {
              return a_noanchor === b_noanchor ? 0 : (a_noanchor ? -1 : 1);
            }

            return (a.anchors[0].target.selector[0].start - b.anchors[0].target.selector[0].start);
          });
      if (this.studySessionId === null && !(this.downloadBeforeStudyClosingAllowed)) {
        return annotations.filter(annotation =>
          !this.openSessionIds.includes(annotation.studySessionId)
        );
      } else {
        return annotations;
      }
    },
    comments() {
      const comments = this.$store.getters["table/comment/getFiltered"](c => 
          c.documentId === this.documentId && c.parentCommentId === null
        );
      if (this.studySessionId === null && !(this.downloadBeforeStudyClosingAllowed)) {
        return comments.filter(comment =>
          !this.openSessionIds.includes(comment.studySessionId)
        );
      } else {
        return comments;
      }
    },
  },
  watch: {
    // React to external changes to the saved scroll value (e.g., from store updates)
    async savedScroll(newVal, oldVal) {
      // Scroll the viewer container to the saved scroll position
      if (this.$refs.viewer && newVal) {
        await this.delay(1000);
        scrollElement(this.$refs.viewer, parseFloat(newVal.value));
      }
      },
    studySessionId(newVal, oldVal) {
      if (oldVal !== newVal) {
        this.$socket.emit("documentGetData", {
          documentId: this.documentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId
        });
      }
    },
    studyStepId(newVal, oldVal) {
      if (oldVal !== newVal) {
        this.$socket.emit("documentGetData", {
          documentId: this.documentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId
        });
      }
    }
  },
  mounted() {
    this.eventBus.on('pdfScroll', (annotationId) => {
      this.scrollTo(annotationId);
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "pdfScroll",
          data: {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            annotationId: annotationId
          }
        });
      }
    });

    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    // get tagsets
    /*this.$socket.emit("tagSetGetAll", {}, (result) => {
      if (!result.success) {
        this.eventBus.emit('toast', {
          title: "Tag Set Error",
          message: result.message,
          variant: "danger"
        });
      }
    });*/
    /*this.$socket.emit("tagGetAll", {}, (result) => {
      if (!result.success) {
        this.eventBus.emit('toast', {
          title: "Tag Error",
          message: result.message,
          variant: "danger"
        });
      }
    });*/

    // init component
    this.load();

    // scrolling
    this.$refs.viewer.addEventListener("scroll", this.scrollActivity);
    document.addEventListener('copy', this.onCopy);
    // Scroll the viewer container to the saved scroll position
    this.$nextTick(async () => {
      // Ensure the viewer is available before setting scrollTop
      if (this.$refs.viewer && this.savedScroll) {
        // Add a short delay instead of waiting for anchors
        await this.delay(300);
        scrollElement(this.$refs.viewer, parseFloat(this.savedScroll.value));
      }
    });

  },
  beforeUnmount() {
    // Leave the room for document updates
    this.$socket.emit("collabUnsubscribe", {documentId: this.documentId});
    this.$refs.viewer.removeEventListener("scroll", this.scrollActivity);
    document.removeEventListener('copy', this.onCopy);
    window.removeEventListener('resize', this.handleResize);
    
     if (!this.savedScroll) {
      this.$socket.emit("appDataUpdate", {
        table: "user_environment",
        data: {
          userId: this.userId,
          documentId: this.documentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          key: "scroll",
          value: this.$refs.viewer.scrollTop
        }
      });
    } else {
      this.$socket.emit("appDataUpdate", {
        table: "user_environment",
        data: {
          id: this.savedScroll.id,
          value: this.$refs.viewer.scrollTop
        }
      });
    }
  },
  methods: {
    handleResize() {
      if (window.innerWidth <= 900) {
        this.isSidebarVisible = false;
        this.sidebarIconHighlight = true;
        setTimeout(() => {
          this.sidebarIconHighlight = false;
        }, 1000);
        this.logHideSidebar();
      }
      else {
        this.isSidebarVisible = true;
      }
      
      // Log resize event with debouncing
      this.logResize(window.innerWidth, this.isSidebarVisible);
    },
    ...mapMutations({
      setSetting: "settings/set",
    }),
    decisionSubmit(decision) {
      this.$refs.decisionSubmit.open(decision)
    },
    toggleNlp() {
      const newNlpActive = !this.nlpActive
      this.setSetting({
        key: 'annotator.nlp.activated',
        value: newNlpActive
      })
      this.$socket.emit('appSettingSet', {
        key: 'annotator.nlp.activated',
        value: newNlpActive
      })
    },
    toggleSidebar() {
      this.isSidebarVisible = !this.isSidebarVisible;
    },
    scrollActivity() {
      this.logScroll();
    },
    async scrollTo(annotationId) {
      const annotation = this.$store.getters['table/annotation/get'](annotationId);
      const scrollContainer = this.$refs.viewer || document.getElementById('viewerContainer');
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
        offset -= 106; // see css class padding-top
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
        await scrollToPage(scrollContainer, annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number, { align: 'start', maxDuration: 10 });
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
      if (!anchor.highlights) {
        // This anchor was not resolved to a location in the document.
        return null;
      }
      const highlight = anchor.highlights[0];
      return offsetRelativeTo(highlight, document.querySelector('#viewerContainer'));
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
    load() {
      this.$socket.emit("documentGetData", {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId
      });

      // Join Room for document updates
      this.$socket.emit("documentSubscribe", {documentId: this.documentId}, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: "Document subscribe error",
            message: res.message,
            variant: "danger",
          });
        }
      });

      // check for available nlp support (for now hard-coded sentiment analysis)
      if (this.nlpEnabled) {
        this.$socket.emit("serviceCommand", {
          service: "NLPService",
          command: "skillGetConfig",
          data: {name: "sentiment_classification"}
        });
      }
    },
    async leave() {
      return await this.$refs.sidebar.leave();
    },
    downloadAnnotations() {

      const attributesToDelete = [
        "draft",
        "anonymous",
        "createdAt",
        "updatedAt",
        "deleted",
        "deletedAt",
        "documentId",
        "studySessionId",
        "studyStepId",
        "userId"
      ];
      const annotations = this.annotations.map(a => {
        return Object.fromEntries(Object.entries(a).filter(([key]) => !attributesToDelete.includes(key)));
      });
      // change tagId to tagName
      annotations.forEach(a => {
        if (a.tagId) {
          const tag = this.$store.getters["table/tag/get"](a.tagId);
          a.tag = tag.name;
          delete a.tagId;
        }
      });

      const comments = this.comments.map(c => {
        return Object.fromEntries(Object.entries(c).filter(([key]) => !attributesToDelete.includes(key)));
      });

      const content = mergeAnnotationsAndComments(annotations, comments);

      const filename = `annotations_${this.documentId}_${Date.now()}.json`;
      downloadObjectsAs(content, filename, "json");

    },
    onCopy() {
      const selection = document.getSelection();
      if (selection && selection.toString().trim() !== '') {
        const copiedText = selection.toString();
        if (this.acceptStats) {
          this.$socket.emit("stats", {
            action: "textCopied",
            data: {
              documentId: this.documentId,
              studySessionId: this.studySessionId,
              studyStepId: this.studyStepId,
              copiedText: copiedText,
            }
          });
        }
      }
    },
  }
}
</script>

<style scoped>

#sidebarContainer {
  position: relative;
  padding: 0;
}

IconBoostrap[disabled] {
  background-color: darkgrey;
}

#sidebarContainer::-webkit-scrollbar {
  display: none;
}

.sidebar-highlight {
  border: 2px solid #ff9800 !important;
  box-shadow: 0 0 8px #ff9800;
  border-radius: 4px;
  transition: border 0.2s, box-shadow 0.2s;
}

</style>
