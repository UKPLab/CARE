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
            ref="sidebar" :show="isSidebarVisible"
        />
      </div>
    </div>

    <Teleport to="#topBarNavItems">
      <li class="nav-item">
        <button
            v-if="studySessionId === null && numStudyComments > 0"
            :title="showAll ? 'Hide study comments' : 'Show study comments'"
            class="btn rounded-circle"
            type="button"
            @click="setSetting({key: 'annotator.showAllComments', value: !showAll})"
        >
          <span class="position-relative translate-middle top-100 start-100 fs-10 fw-light">
            {{ numStudyComments }}
          </span>
          <span>
            <LoadIcon
                :icon-name="showAll ? 'eye-slash-fill' : 'eye-fill'"
                :size="18"
            />
          </span>
        </button>
      </li>
      <li class="nav-item">

        <button
            v-if="nlpEnabled"
            :title="nlpActive ? 'Deactivate NLP support' : 'Activate NLP support'"
            class="btn rounded-circle"
            type="button"
            @click="toggleNlp"
        >


          <LoadIcon
              :color="(!nlpActive) ?'#777777':'#097969'"
              :size="18"
              icon-name="robot"
          />
        </button>
        <button
            :title="isSidebarVisible ? 'Hide sidebar' : 'Show sidebar'"
            class="btn rounded-circle"
            type="button"
            @click="toggleSidebar"
        >
          <LoadIcon
              :icon-name="isSidebarVisible ? 'layout-sidebar-inset-reverse' : 'layout-sidebar-reverse'"
              :size="18"
          />
        </button>
      </li>
      <ExpandMenu class="nav-item"/>
    </Teleport>

    <Teleport to="#topBarExtendMenuItems">
      <li><a
          :class="annotations.length + comments.length > 0 && !downloading ? '' : 'disabled'"
          class="dropdown-item"
          href="#"
          @click="downloadAnnotations('json')"
      >Download
        Annotations</a></li>
    </Teleport>

    <Teleport to="#topbarCustomPlaceholder">
      <form class="hstack gap-3 container-fluid justify-content-center">
        <button
            v-if="review"
            class="btn btn-outline-success me-2"
            type="button"
            @click="$refs.reviewSubmit.open()"
        >Submit Review
        </button>
        <button
            v-if="approve"
            class="btn btn-outline-dark me-2"
            type="button"
            @click="$refs.report.open()"
        >
          Report
        </button>
        <button
            v-if="approve"
            class="btn btn-outline-success me-2"
            type="button"
            @click="decisionSubmit(true)"
        >
          Accept
        </button>
        <button
            v-if="approve"
            class="btn btn-outline-danger me-2"
            type="button"
            @click="decisionSubmit(false)"
        >
          Reject
        </button>
      </form>
    </Teleport>

    <ExportAnnos ref="export"/>
  </span>
</template>

<script>
/** Annotator Component
 *
 * This parent component provides the annotation view, which
 * currently consists of all elements of the annotator.
 *
 * @author Dennis Zyska
 */
import PDFViewer from "./pdfViewer/PDFViewer.vue";
import Sidebar from "./sidebar/Sidebar.vue";
import Loader from "@/basic/Loading.vue";
import ExportAnnos from "@/basic/download/ExportAnnos.vue"
import {offsetRelativeTo, scrollElement} from "@/assets/anchoring/scroll";
import {isInPlaceholder} from "@/assets/anchoring/placeholder";
import {resolveAnchor} from "@/assets/anchoring/resolveAnchor";
import debounce from 'lodash.debounce';
import LoadIcon from "@/basic/Icon.vue";
import ExpandMenu from "@/basic/navigation/ExpandMenu.vue";
import {mapMutations} from "vuex";
import {computed} from "vue";

export default {
  name: "AnnotatorView",
  components: {
    LoadIcon,
    PDFViewer,
    ExpandMenu,
    Sidebar,
    Loader,
    ExportAnnos
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
      default: () => false
    },
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
      default: 0,
    },
  },
  data() {
    return {
      downloading: false,
      isSidebarVisible: true,
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
      }, 500)
    }
  },
  computed: {
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
    annotations() {
      return this.$store.getters["table/annotation/getByKey"]('documentId', this.documentId)
          .sort((a, b) => {
            const a_noanchor = a.anchors === null || a.anchors.length === 0;
            const b_noanchor = b.anchors === null || b.anchors.length === 0;

            if (a_noanchor || b_noanchor) {
              return a_noanchor === b_noanchor ? 0 : (a_noanchor ? -1 : 1);
            }

            return (a.anchors[0].target.selector[0].start - b.anchors[0].target.selector[0].start);
          });
    },
    comments() {
      return this.$store.getters["table/comment/getFiltered"](comm => comm.documentId === this.documentId && comm.parentCommentId === null);
    },
    nlpActive() {
      const nlpActive = this.$store.getters["settings/getValue"]("annotator.nlp.activated");
      return (nlpActive === true || nlpActive === "true");
    },
    nlpEnabled() {
      return this.$store.getters["settings/getValue"]('service.nlp.enabled') === "true";
    },
    numStudyComments() {
      return this.comments.filter(c => c.studySessionId === this.studySessionId && c.studyStepId === this.studyStepId).length;
    }
  },
  watch: {
    studySessionId(newVal, oldVal) {
      if (oldVal !== newVal) {
        this.$socket.emit("documentGetData", {documentId: this.documentId, studySessionId: this.studySessionId , studyStepId: this.studyStepId});
      }
    },
    studyStepId(newVal, oldVal) {
      if (oldVal !== newVal) {
        this.$socket.emit("documentGetData", {documentId: this.documentId, studySessionId: this.studySessionId , studyStepId: this.studyStepId});
      }
    },
  },
  mounted() {
    this.eventBus.on('pdfScroll', (annotationId) => {
      this.scrollTo(annotationId);
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "pdfScroll",
          data: {documentId: this.documentId, studySessionId: this.studySessionId, studyStepId: this.studyStepId, annotationId: annotationId}
        });
      }
    });

    // get tagsets
    this.$socket.emit("tagSetGetAll");
    this.$socket.emit("tagGetAll");

    // init component
    this.load();

    // scrolling
    this.$refs.viewer.addEventListener("scroll", this.scrollActivity);
    document.addEventListener('copy', this.onCopy);
  },
  beforeUnmount() {
    // Leave the room for document updates
    this.$socket.emit("collabUnsubscribe", {documentId: this.documentId});
    this.$refs.viewer.removeEventListener("scroll", this.scrollActivity);
    document.removeEventListener('copy', this.onCopy);
  },
  methods: {
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
      const annotation = this.$store.getters['table/annotation/get'](annotationId)

      if ("anchors" in annotation) {
        const anchor = annotation.anchors[0]
        const range = resolveAnchor(anchor);
        if (!range) {
          return;
        }

        const inPlaceholder = this.anchorIsInPlaceholder(anchor);
        let offset = this._anchorOffset(anchor);
        if (offset === null) {
          return;
        }

        const scrollContainer = document.getElementById('viewerContainer');
        // Correct offset since we have a fixed top
        offset -= 52.5; // see css class padding-top


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
          const offset = this._anchorOffset(anchor);
          if (offset === null) {
            return;
          }
          await scrollElement(scrollContainer, offset);
        }

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
      if (this.studySessionId && this.studyStepId && this.studySessionId !== 0 && this.studyStepId !== 0) {
            this.$socket.emit("documentGetData", {documentId: this.documentId, studySessionId: this.studySessionId, studyStepId: this.studyStepId});
      }

      // Join Room for document updates
      this.$socket.emit("documentSubscribe", {documentId: this.documentId});

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
    downloadAnnotations(outputType) {
      this.$refs.export.requestExport([this.documentId], outputType, true);
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

@media screen and (max-width: 900px) {
  #sidebarContainer {
    display: none;
  }
}

</style>
